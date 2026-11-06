/**
 * Proyecto Prisma — Main Controller del Banco de Calibración
 */

import { PrismaAudioEngine } from './audio-engine.ts';
import { VisualRenderer } from './visual-renderer.ts';
import { SynchronizationMeasurement } from './types.ts';

const canvas = document.getElementById('stimulus-canvas') as HTMLCanvasElement;
const renderer = new VisualRenderer(canvas);
const audioEngine = new PrismaAudioEngine();

let trialCounter = 0;
let pinkActive = false;
let binauralActive = false;

// Elementos de UI
const metricFps = document.getElementById('metric-fps')!;
const metricFrameBudget = document.getElementById('metric-frame-budget')!;
const metricBaseLatency = document.getElementById('metric-base-latency')!;
const metricOutputLatency = document.getElementById('metric-output-latency')!;
const metricTotalLatency = document.getElementById('metric-total-latency')!;
const metricBluetooth = document.getElementById('metric-bluetooth')!;
const logTbody = document.getElementById('log-tbody')!;

const btnUnlock = document.getElementById('btn-unlock-audio') as HTMLButtonElement;
const btnFlashBeep = document.getElementById('btn-flash-beep') as HTMLButtonElement;
const btnDemo = document.getElementById('btn-demo-stimulus') as HTMLButtonElement;
const btnTogglePink = document.getElementById('btn-toggle-pink') as HTMLButtonElement;
const sliderPink = document.getElementById('slider-pink') as HTMLInputElement;
const btnToggleBinaural = document.getElementById('btn-toggle-binaural') as HTMLButtonElement;
const sliderBinaural = document.getElementById('slider-binaural') as HTMLInputElement;
const btnTestStereo = document.getElementById('btn-test-stereo') as HTMLButtonElement;
const canvasStatus = document.getElementById('canvas-status')!;

// Inicialización
window.addEventListener('resize', () => renderer.resize());
renderer.drawFixationCross();

// 1. Calibrar FPS de pantalla
renderer.calibrateDisplayFps().then((fps) => {
  metricFps.textContent = `${fps} Hz`;
  metricFrameBudget.textContent = `${renderer.getFrameDurationMs().toFixed(2)} ms`;
});

// 2. Desbloquear Audio & Calibrar
async function updateHardwareMetrics() {
  const profile = audioEngine.getHardwareProfile(renderer.getDetectedFps());
  metricBaseLatency.textContent = `${profile.baseLatencyMs.toFixed(1)} ms`;
  metricOutputLatency.textContent = `${profile.outputLatencyMs.toFixed(1)} ms`;
  metricTotalLatency.textContent = `${profile.totalHardwareLatencyMs.toFixed(1)} ms`;

  if (profile.isBluetoothSuspected) {
    metricBluetooth.textContent = '⚠️ Alta (>80ms, posible BT)';
    metricBluetooth.style.color = '#f87171';
  } else {
    metricBluetooth.textContent = 'Óptima (Baja latencia)';
    metricBluetooth.style.color = '#34d399';
  }
}

btnUnlock.addEventListener('click', async () => {
  const ok = await audioEngine.unlock();
  if (ok) {
    btnUnlock.textContent = '✅ Audio Activo & Calibrado';
    btnUnlock.style.background = '#059669';
    await updateHardwareMetrics();
  }
});

// 3. Test de Sincronía (Flash + Beep)
btnFlashBeep.addEventListener('click', async () => {
  await audioEngine.unlock();
  await updateHardwareMetrics();

  trialCounter++;
  const trialId = `trial_${trialCounter.toString().padStart(3, '0')}`;
  canvasStatus.textContent = 'Disparando estímulo sincronizado...';

  const beepBuffer = audioEngine.createTestBeepBuffer(880, 0.06);
  const lookaheadMs = 120; // 120ms para garantizar que entre en el buffer
  const stimulus = audioEngine.scheduleSynchronizedStimulus(beepBuffer, lookaheadMs, 0);

  // Programar frame visual en Canvas
  const measurement = await renderer.scheduleFrameAt(
    stimulus.estimatedVisualPerfTime,
    () => {
      renderer.drawCalibrationFlash('#ffffff');
      setTimeout(() => renderer.drawFixationCross(), 80);
    },
    trialId
  );

  canvasStatus.textContent = 'Listo';
  appendLogRow(measurement);
});

function appendLogRow(m: SynchronizationMeasurement) {
  if (trialCounter === 1) {
    logTbody.innerHTML = '';
  }

  const tr = document.createElement('tr');
  const badgeClass = m.withinTolerance ? 'badge-ok' : 'badge-warn';
  const badgeText = m.withinTolerance ? 'PASS' : 'WARN';

  tr.innerHTML = `
    <td>${m.trialId}</td>
    <td>${renderer.getDetectedFps()} Hz</td>
    <td>${m.estimatedAudioPerfTime.toFixed(1)} ms</td>
    <td>${m.actualVisualPerfTime.toFixed(1)} ms</td>
    <td style="font-weight: bold; color: ${m.withinTolerance ? 'var(--success)' : 'var(--danger)'}">
      ${m.measuredDriftMs > 0 ? '+' : ''}${m.measuredDriftMs.toFixed(2)} ms
    </td>
    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
  `;

  logTbody.insertBefore(tr, logTbody.firstChild);
}

// 4. Demo Estímulo Dual-Coding
btnDemo.addEventListener('click', async () => {
  await audioEngine.unlock();
  canvasStatus.textContent = 'Exposición Dual-Coding: vasken';

  // 1. Fijación
  renderer.drawFixationCross();

  // 2. Audio Beep sintetizado para simular fonética nativa
  const sampleAudio = audioEngine.createTestBeepBuffer(520, 0.4);
  const lookaheadMs = 200;
  const stimulus = audioEngine.scheduleSynchronizedStimulus(sampleAudio, lookaheadMs, 0);

  // 3. Render visual en Canvas
  await renderer.scheduleFrameAt(stimulus.estimatedVisualPerfTime, () => {
    renderer.drawStimulus(null, 'vasken', '/ˈvæs.kɛn/');
  });

  // 4. Vuelta a descanso tras 2 segundos
  setTimeout(() => {
    renderer.drawFixationCross();
    canvasStatus.textContent = 'Listo';
  }, 2200);
});

// 5. Ruido Rosa
btnTogglePink.addEventListener('click', async () => {
  await audioEngine.unlock();
  pinkActive = !pinkActive;
  audioEngine.setPinkNoise(pinkActive, parseFloat(sliderPink.value));
  btnTogglePink.textContent = `Ruido Rosa: ${pinkActive ? 'ON' : 'OFF'}`;
  btnTogglePink.style.background = pinkActive ? '#0284c7' : '#1e293b';
});

sliderPink.addEventListener('input', () => {
  if (pinkActive) {
    audioEngine.setPinkNoise(true, parseFloat(sliderPink.value));
  }
});

// 6. Binaural Beat 20Hz
btnToggleBinaural.addEventListener('click', async () => {
  await audioEngine.unlock();
  binauralActive = !binauralActive;
  audioEngine.setBinauralBeat(binauralActive, 210, 20, parseFloat(sliderBinaural.value));
  btnToggleBinaural.textContent = `Beta 20Hz: ${binauralActive ? 'ON' : 'OFF'}`;
  btnToggleBinaural.style.background = binauralActive ? '#0284c7' : '#1e293b';
});

sliderBinaural.addEventListener('input', () => {
  if (binauralActive) {
    audioEngine.setBinauralBeat(true, 210, 20, parseFloat(sliderBinaural.value));
  }
});

// 7. Test Estéreo L/R
btnTestStereo.addEventListener('click', async () => {
  await audioEngine.unlock();
  btnTestStereo.textContent = '🔊 Reproduciendo Izquierda -> Derecha...';
  await audioEngine.verifyStereoChannels();
  btnTestStereo.textContent = '🎧 Verificar Canales L / R';
});
