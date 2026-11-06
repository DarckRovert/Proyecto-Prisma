/**
 * VisualRenderer — Motor de renderizado visual en Canvas con sincronización sub-frame
 * 
 * Monitorea deltas de fotogramas, detecta la tasa de refresco real de la pantalla
 * y ejecuta el dibujo en el fotograma óptimo respecto al reloj de audio.
 */

import { SynchronizationMeasurement } from './types.ts';

export class VisualRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private detectedFps: number = 60;
  private frameDurationMs: number = 16.666;
  private isCalibratingFps: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('No se pudo obtener el contexto 2D del Canvas');
    this.ctx = context;
    this.resize();
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 600) * dpr;
    this.canvas.height = (rect.height || 400) * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public async calibrateDisplayFps(): Promise<number> {
    if (this.isCalibratingFps) return this.detectedFps;
    this.isCalibratingFps = true;

    return new Promise((resolve) => {
      const deltas: number[] = [];
      let lastTime = performance.now();
      let framesCount = 0;

      const sampleFrame = (time: number) => {
        const delta = time - lastTime;
        lastTime = time;
        if (framesCount > 5) { // Descartar los primeros fotogramas de calentamiento
          deltas.push(delta);
        }
        framesCount++;

        if (deltas.length >= 100) {
          deltas.sort((a, b) => a - b);
          const medianDelta = deltas[Math.floor(deltas.length / 2)];
          const rawFps = 1000 / medianDelta;

          // Redondeo inteligente a los estándares comunes de hardware
          if (rawFps >= 220) this.detectedFps = 240;
          else if (rawFps >= 135) this.detectedFps = 144;
          else if (rawFps >= 110) this.detectedFps = 120;
          else if (rawFps >= 80) this.detectedFps = 90;
          else if (rawFps >= 70) this.detectedFps = 75;
          else this.detectedFps = 60;

          this.frameDurationMs = 1000 / this.detectedFps;
          this.isCalibratingFps = false;
          resolve(this.detectedFps);
        } else {
          requestAnimationFrame(sampleFrame);
        }
      };

      requestAnimationFrame(sampleFrame);
    });
  }

  public clear(color: string = '#0f172a'): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, rect.width || 600, rect.height || 400);
  }

  public drawFixationCross(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 400;
    const cx = w / 2;
    const cy = h / 2;

    this.clear('#0b0f19');

    this.ctx.strokeStyle = '#94a3b8';
    this.ctx.lineWidth = 3;

    this.ctx.beginPath();
    this.ctx.moveTo(cx - 16, cy);
    this.ctx.lineTo(cx + 16, cy);
    this.ctx.moveTo(cx, cy - 16);
    this.ctx.lineTo(cx, cy + 16);
    this.ctx.stroke();
  }

  public drawCalibrationFlash(color: string = '#f8fafc'): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 400;
    this.clear('#0b0f19');

    // Cuadro de flash centrado de alta saliencia
    const size = 180;
    this.ctx.fillStyle = color;
    this.ctx.fillRect((w - size) / 2, (h - size) / 2, size, size);
  }

  public drawStimulus(
    image: HTMLImageElement | null,
    text: string,
    ipa: string
  ): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 400;
    this.clear('#020617');

    const cx = w / 2;

    if (image && image.complete && image.naturalWidth > 0) {
      const imgSize = Math.min(220, h * 0.55);
      const ix = cx - imgSize / 2;
      const iy = 30;
      this.ctx.drawImage(image, ix, iy, imgSize, imgSize);
    }

    // Texto del lema
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '700 32px ui-sans-serif, system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, cx, h - 70);

    // Transcripción IPA
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = '500 20px ui-monospace, monospace';
    this.ctx.fillText(ipa, cx, h - 35);
  }

  public scheduleFrameAt(
    targetPerfTime: number,
    onDraw: () => void,
    trialId: string = 'bench'
  ): Promise<SynchronizationMeasurement> {
    const toleranceWindow = this.frameDurationMs * 0.75;

    return new Promise((resolve) => {
      const checkFrame = () => {
        const now = performance.now();
        // Disparar en el frame que contenga el tiempo objetivo
        if (now >= targetPerfTime - toleranceWindow) {
          onDraw();
          const actualVisualPerfTime = performance.now();
          const drift = actualVisualPerfTime - targetPerfTime;

          resolve({
            trialId,
            scheduledAudioTime: 0,
            actualVisualPerfTime: Math.round(actualVisualPerfTime * 100) / 100,
            estimatedAudioPerfTime: Math.round(targetPerfTime * 100) / 100,
            measuredDriftMs: Math.round(drift * 100) / 100,
            withinTolerance: Math.abs(drift) <= this.frameDurationMs
          });
        } else {
          requestAnimationFrame(checkFrame);
        }
      };

      requestAnimationFrame(checkFrame);
    });
  }

  public getDetectedFps(): number {
    return this.detectedFps;
  }

  public getFrameDurationMs(): number {
    return this.frameDurationMs;
  }
}
