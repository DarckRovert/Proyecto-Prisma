/**
 * PrismaAudioEngine — Motor de audio de ultra-precisión para Proyecto Prisma
 * 
 * Sincronización a nivel de hardware clock (AudioContext.currentTime),
 * síntesis de ruido rosa en AudioWorklet, pulsos binaurales en fase estéreo
 * y compensación activa de outputLatency / baseLatency.
 */

import { HardwareLatencyProfile, ScheduledStimulus } from './types.ts';

export class PrismaAudioEngine {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private pinkNoiseNode: AudioWorkletNode | null = null;
  private binauralLeftOsc: OscillatorNode | null = null;
  private binauralRightOsc: OscillatorNode | null = null;
  private binauralGain: GainNode | null = null;
  private isUnlocked: boolean = false;

  public async initialize(): Promise<void> {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // Master bus ambiental con GainNode para ducking
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.ambientGain.connect(this.ctx.destination);

    // Cargar AudioWorklet de ruido rosa
    try {
      await this.ctx.audioWorklet.addModule('/worklets/pink-noise-processor.js');
      this.pinkNoiseNode = new AudioWorkletNode(this.ctx, 'pink-noise-processor');
      this.pinkNoiseNode.connect(this.ambientGain);
    } catch (err) {
      console.warn('[AudioEngine] No se pudo inicializar AudioWorklet (modo fallback):', err);
    }
  }

  public async unlock(): Promise<boolean> {
    if (!this.ctx) await this.initialize();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isUnlocked = this.ctx.state === 'running';
    return this.isUnlocked;
  }

  public getHardwareProfile(detectedFps: number = 60): HardwareLatencyProfile {
    if (!this.ctx) {
      return {
        detectedFpsHz: detectedFps,
        baseLatencyMs: 0,
        outputLatencyMs: 0,
        totalHardwareLatencyMs: 0,
        isBluetoothSuspected: false,
        sampleRate: 48000
      };
    }

    const baseMs = (this.ctx.baseLatency || 0.005) * 1000;
    // outputLatency está presente en navegadores modernos; si no, fallback a 0
    const outputSec = 'outputLatency' in this.ctx ? (this.ctx as any).outputLatency : 0.015;
    const outputMs = outputSec * 1000;
    const totalMs = baseMs + outputMs;

    return {
      detectedFpsHz: detectedFps,
      baseLatencyMs: Math.round(baseMs * 100) / 100,
      outputLatencyMs: Math.round(outputMs * 100) / 100,
      totalHardwareLatencyMs: Math.round(totalMs * 100) / 100,
      isBluetoothSuspected: totalMs > 80.0,
      sampleRate: this.ctx.sampleRate
    };
  }

  public setPinkNoise(active: boolean, targetVolumeDb: number = -18): void {
    if (!this.ambientGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gainValue = active ? Math.pow(10, targetVolumeDb / 20) : 0.0;
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
    this.ambientGain.gain.linearRampToValueAtTime(gainValue, now + 0.1);
  }

  public setBinauralBeat(active: boolean, carrierHz: number = 210, beatHz: number = 20, volumeDb: number = -22): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!active) {
      if (this.binauralGain) {
        this.binauralGain.gain.linearRampToValueAtTime(0.0001, now + 0.1);
        setTimeout(() => {
          this.binauralLeftOsc?.stop();
          this.binauralRightOsc?.stop();
          this.binauralLeftOsc?.disconnect();
          this.binauralRightOsc?.disconnect();
          this.binauralLeftOsc = null;
          this.binauralRightOsc = null;
        }, 150);
      }
      return;
    }

    // Si ya existe activo, detenerlo antes de reconfigurar
    this.setBinauralBeat(false);

    const merger = this.ctx.createChannelMerger(2);
    this.binauralGain = this.ctx.createGain();
    const targetGain = Math.pow(10, volumeDb / 20);
    this.binauralGain.gain.setValueAtTime(0.0001, now);
    this.binauralGain.gain.linearRampToValueAtTime(targetGain, now + 0.2);

    // Oscilador Izquierdo
    this.binauralLeftOsc = this.ctx.createOscillator();
    this.binauralLeftOsc.type = 'sine';
    this.binauralLeftOsc.frequency.setValueAtTime(carrierHz, now);

    // Oscilador Derecho (carrierHz + beatHz)
    this.binauralRightOsc = this.ctx.createOscillator();
    this.binauralRightOsc.type = 'sine';
    this.binauralRightOsc.frequency.setValueAtTime(carrierHz + beatHz, now);

    // Enrutar Izquierdo a canal 0, Derecho a canal 1
    this.binauralLeftOsc.connect(merger, 0, 0);
    this.binauralRightOsc.connect(merger, 0, 1);
    merger.connect(this.binauralGain);
    this.binauralGain.connect(this.ctx.destination);

    this.binauralLeftOsc.start(now);
    this.binauralRightOsc.start(now);
  }

  public createTestBeepBuffer(freqHz: number = 880, durationSec: number = 0.08): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext no inicializado');
    const sampleRate = this.ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Envolvente rápida para evitar clicks al inicio y al final
      const env = Math.min(1.0, i / 100) * Math.min(1.0, (numSamples - i) / 100);
      channel[i] = Math.sin(2 * Math.PI * freqHz * t) * env * 0.5;
    }
    return buffer;
  }

  public scheduleSynchronizedStimulus(
    buffer: AudioBuffer,
    lookaheadMs: number = 100,
    targetOffsetMs: number = 0
  ): ScheduledStimulus {
    if (!this.ctx) throw new Error('AudioContext no inicializado');

    const nowAudio = this.ctx.currentTime;
    const nowPerf = performance.now();

    const scheduledAudioTime = nowAudio + lookaheadMs / 1000;
    const bufferDuration = buffer.duration;

    // Ducking del audio ambiental
    if (this.ambientGain && this.ambientGain.gain.value > 0.001) {
      const currentVol = this.ambientGain.gain.value;
      const duckedVol = currentVol * 0.25; // Atenuación de 12 dB
      this.ambientGain.gain.setValueAtTime(currentVol, scheduledAudioTime - 0.05);
      this.ambientGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, duckedVol), scheduledAudioTime);
      this.ambientGain.gain.setValueAtTime(duckedVol, scheduledAudioTime + bufferDuration);
      this.ambientGain.gain.exponentialRampToValueAtTime(currentVol, scheduledAudioTime + bufferDuration + 0.1);
    }

    // Disparo del buffer fonético
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start(scheduledAudioTime);

    // Calcular el timestamp estimado en la línea de tiempo de performance.now()
    // Cuando el usuario escucha físicamente el audio: scheduledAudioTime + baseLatency + outputLatency
    const hardwareLatencySec = (this.ctx.baseLatency || 0.005) + (('outputLatency' in this.ctx ? (this.ctx as any).outputLatency : 0.015) || 0);
    const physicalSoundArrivalPerf = nowPerf + (scheduledAudioTime - nowAudio) * 1000 + hardwareLatencySec * 1000;

    // Momento en que la imagen debe pintarse según la condición SOA
    const estimatedVisualPerfTime = physicalSoundArrivalPerf + targetOffsetMs;

    return {
      scheduledAudioTime,
      estimatedVisualPerfTime,
      targetOffsetMs,
      duckingDurationSeconds: bufferDuration
    };
  }

  public verifyStereoChannels(): Promise<'left' | 'right' | 'complete'> {
    return new Promise((resolve) => {
      if (!this.ctx) {
        resolve('complete');
        return;
      }
      const now = this.ctx.currentTime;
      const beepLeft = this.createTestBeepBuffer(440, 0.25);
      const beepRight = this.createTestBeepBuffer(660, 0.25);

      const merger = this.ctx.createChannelMerger(2);
      merger.connect(this.ctx.destination);

      // Tono 1: Izquierdo (440 Hz)
      const srcL = this.ctx.createBufferSource();
      srcL.buffer = beepLeft;
      srcL.connect(merger, 0, 0);
      srcL.start(now);

      // Tono 2: Derecho (660 Hz a los 400ms)
      const srcR = this.ctx.createBufferSource();
      srcR.buffer = beepRight;
      srcR.connect(merger, 0, 1);
      srcR.start(now + 0.4);

      setTimeout(() => resolve('complete'), 800);
    });
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }
}
