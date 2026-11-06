/**
 * Proyecto Prisma — Main Controller del Laboratorio Cognitivo
 */

import { PrismaAudioEngine } from './audio-engine.ts';
import { VisualRenderer } from './visual-renderer.ts';
import { SessionEngine, type SessionPhase } from './session-engine.ts';
import { db } from './db.ts';
import batteryData from '../data/study1_pseudowords_battery.json';
import type { SynchronizationMeasurement, SessionMetadata } from './types.ts';

const canvas = document.getElementById('stimulus-canvas') as HTMLCanvasElement;
const renderer = new VisualRenderer(canvas);
const audioEngine = new PrismaAudioEngine();
const sessionEngine = new SessionEngine(audioEngine, renderer);

let trialCounter = 0;
let pinkActive = false;
let binauralActive = false;

// Elementos de UI - Métricas
const metricFps = document.getElementById('metric-fps')!;
const metricFrameBudget = document.getElementById('metric-frame-budget')!;
const metricBaseLatency = document.getElementById('metric-base-latency')!;
const metricOutputLatency = document.getElementById('metric-output-latency')!;
const metricTotalLatency = document.getElementById('metric-total-latency')!;
const metricBluetooth = document.getElementById('metric-bluetooth')!;
const logTbody = document.getElementById('log-tbody')!;
const canvasStatus = document.getElementById('canvas-status')!;

// Navegación Tabs
const tabBench = document.getElementById('tab-bench') as HTMLButtonElement;
const tabSession = document.getElementById('tab-session') as HTMLButtonElement;
const benchActions = document.getElementById('bench-actions')!;
const sessionActions = document.getElementById('session-actions')!;
const displayTitle = document.getElementById('display-title')!;

// Overlays de Sesión
const jolOverlay = document.getElementById('jol-overlay')!;
const testOverlay = document.getElementById('test-overlay')!;
const inputRecall = document.getElementById('input-recall') as HTMLInputElement;
const btnSubmitRecall = document.getElementById('btn-submit-recall') as HTMLButtonElement;
const progressFill = document.getElementById('session-progress-fill')!;
const progressText = document.getElementById('session-progress-text')!;
const phaseText = document.getElementById('session-phase-text')!;

// Botones y controles
const btnUnlock = document.getElementById('btn-unlock-audio') as HTMLButtonElement;
const btnFlashBeep = document.getElementById('btn-flash-beep') as HTMLButtonElement;
const btnDemo = document.getElementById('btn-demo-stimulus') as HTMLButtonElement;
const btnStartSession = document.getElementById('btn-start-session') as HTMLButtonElement;
const btnExportTelemetry = document.getElementById('btn-export-telemetry') as HTMLButtonElement;
const btnTogglePink = document.getElementById('btn-toggle-pink') as HTMLButtonElement;
const sliderPink = document.getElementById('slider-pink') as HTMLInputElement;
const btnToggleBinaural = document.getElementById('btn-toggle-binaural') as HTMLButtonElement;
const sliderBinaural = document.getElementById('slider-binaural') as HTMLInputElement;
const btnTestStereo = document.getElementById('btn-test-stereo') as HTMLButtonElement;

// Inicialización de Pantalla y Base de Datos
window.addEventListener('resize', () => renderer.resize());
renderer.drawFixationCross();

// 1. Calibrar FPS de pantalla
renderer.calibrateDisplayFps().then((fps) => {
  metricFps.textContent = `${fps} Hz`;
  metricFrameBudget.textContent = `${renderer.getFrameDurationMs().toFixed(2)} ms`;
});

// 2. Sembrar batería inicial en IndexedDB
db.seedBatteryIfEmpty(batteryData).then((count) => {
  console.log(`[Database] Batería de ${count} estímulos lista en IndexedDB.`);
});

// 3. Desbloquear Audio & Calibrar
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

// 4. Pestañas de Navegación
tabBench.addEventListener('click', () => {
  tabBench.classList.add('active');
  tabSession.classList.remove('active');
  benchActions.style.display = 'grid';
  sessionActions.style.display = 'none';
  displayTitle.textContent = 'Monitor de Estímulos';
});

tabSession.addEventListener('click', () => {
  tabSession.classList.add('active');
  tabBench.classList.remove('active');
  benchActions.style.display = 'none';
  sessionActions.style.display = 'block';
  displayTitle.textContent = 'Sesión Experimental (Estudio 1)';
});

// 5. Test de Sincronía (Flash + Beep)
btnFlashBeep.addEventListener('click', async () => {
  await audioEngine.unlock();
  await updateHardwareMetrics();

  trialCounter++;
  const trialId = `bench_${trialCounter.toString().padStart(3, '0')}`;
  canvasStatus.textContent = 'Disparando estímulo sincronizado...';

  const beepBuffer = audioEngine.createTestBeepBuffer(880, 0.06);
  const lookaheadMs = 120;
  const stimulus = audioEngine.scheduleSynchronizedStimulus(beepBuffer, lookaheadMs, 0);

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
    <td>Bench Sincronía</td>
    <td>--</td>
    <td>--</td>
    <td style="font-weight: bold; color: ${m.withinTolerance ? 'var(--success)' : 'var(--danger)'}">
      ${m.measuredDriftMs > 0 ? '+' : ''}${m.measuredDriftMs.toFixed(2)} ms
    </td>
    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
  `;

  logTbody.insertBefore(tr, logTbody.firstChild);
}

// 6. Demo Estímulo Dual-Coding
btnDemo.addEventListener('click', async () => {
  await audioEngine.unlock();
  canvasStatus.textContent = 'Exposición Dual-Coding: vasken';

  renderer.drawFixationCross();
  const sampleAudio = audioEngine.createTestBeepBuffer(520, 0.4);
  const lookaheadMs = 200;
  const stimulus = audioEngine.scheduleSynchronizedStimulus(sampleAudio, lookaheadMs, 0);

  await renderer.scheduleFrameAt(stimulus.estimatedVisualPerfTime, () => {
    renderer.drawStimulus(null, 'vasken', '/ˈvæs.kɛn/');
  });

  setTimeout(() => {
    renderer.drawFixationCross();
    canvasStatus.textContent = 'Listo';
  }, 2200);
});

// 7. Configuración de Sesión Experimental
sessionEngine.setListener({
  onPhaseChange: (phase: SessionPhase, data?: any) => {
    phaseText.textContent = `Fase: ${phase.toUpperCase()}`;

    // Manejo de Overlay JOL
    if (phase === 'jol_prompt') {
      jolOverlay.style.display = 'block';
      const btns = jolOverlay.querySelectorAll<HTMLButtonElement>('.btn-jol');
      btns.forEach((btn) => {
        btn.onclick = () => {
          jolOverlay.style.display = 'none';
          const val = parseInt(btn.getAttribute('data-val') || '3', 10);
          data.onSubmitJol(val);
        };
      });
    } else {
      jolOverlay.style.display = 'none';
    }

    // Manejo de Overlay Recuperación Activa
    if (phase === 'testing_active') {
      testOverlay.style.display = 'block';
      inputRecall.value = '';
      inputRecall.focus();

      const submit = () => {
        testOverlay.style.display = 'none';
        data.onAnswer(inputRecall.value);
      };

      btnSubmitRecall.onclick = submit;
      inputRecall.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
      };
    } else {
      testOverlay.style.display = 'none';
    }

    // Actualizar log en caso de feedback
    if (phase === 'feedback' && data) {
      appendSessionLogRow(data);
    }
  },

  onProgress: (current: number, total: number) => {
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `Progreso: ${current} / ${total}`;
  },

  onSessionComplete: (metadata: SessionMetadata) => {
    btnStartSession.disabled = false;
    btnStartSession.textContent = '▶️ Iniciar Nueva Sesión';
    alert(`¡Sesión Completada!\n\nÍtems procesados: ${metadata.totalTrials}\nPrecisión: ${(metadata.accuracyRate * 100).toFixed(0)}%\nLatencia media: ${metadata.averageLatencyMs} ms`);
  }
});

function appendSessionLogRow(data: any) {
  const tr = document.createElement('tr');
  const isCorrect = data.accuracy;
  const gradeNames = ['', 'Again (1)', 'Hard (2)', 'Good (3)', 'Easy (4)'];

  tr.innerHTML = `
    <td>${data.stimulus.id}</td>
    <td>Prisma Activo</td>
    <td>${data.gradeResult?.reason || '--'}</td>
    <td style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
      ${isCorrect ? 'Correcto' : 'Error'}
    </td>
    <td><span class="badge ${isCorrect ? 'badge-ok' : 'badge-warn'}">${gradeNames[data.gradeResult?.grade] || 'Good'}</span></td>
    <td><span class="badge badge-ok">GUARDADO</span></td>
  `;

  logTbody.insertBefore(tr, logTbody.firstChild);
}

btnStartSession.addEventListener('click', async () => {
  await audioEngine.unlock();
  await updateHardwareMetrics();

  btnStartSession.disabled = true;
  btnStartSession.textContent = 'Sesión en curso...';

  // Cargar primeros 10 estímulos de la base local para la sesión
  const allStimuli = await db.stimuli.toArray();
  const sessionItems = allStimuli.slice(0, 10);

  await sessionEngine.startSession(sessionItems, 'experimental_study');
});

// 8. Exportar Telemetría a JSON
btnExportTelemetry.addEventListener('click', async () => {
  const jsonStr = await db.exportAllTelemetry();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prisma_telemetry_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// 9. Controles de Audio Ambiental
btnTogglePink.addEventListener('click', async () => {
  await audioEngine.unlock();
  pinkActive = !pinkActive;
  audioEngine.setPinkNoise(pinkActive, parseFloat(sliderPink.value));
  btnTogglePink.textContent = `Ruido Rosa: ${pinkActive ? 'ON' : 'OFF'}`;
  btnTogglePink.style.background = pinkActive ? '#0284c7' : '#1e293b';
});

sliderPink.addEventListener('input', () => {
  if (pinkActive) audioEngine.setPinkNoise(true, parseFloat(sliderPink.value));
});

btnToggleBinaural.addEventListener('click', async () => {
  await audioEngine.unlock();
  binauralActive = !binauralActive;
  audioEngine.setBinauralBeat(binauralActive, 210, 20, parseFloat(sliderBinaural.value));
  btnToggleBinaural.textContent = `Beta 20Hz: ${binauralActive ? 'ON' : 'OFF'}`;
  btnToggleBinaural.style.background = binauralActive ? '#0284c7' : '#1e293b';
});

sliderBinaural.addEventListener('input', () => {
  if (binauralActive) audioEngine.setBinauralBeat(true, 210, 20, parseFloat(sliderBinaural.value));
});

btnTestStereo.addEventListener('click', async () => {
  await audioEngine.unlock();
  btnTestStereo.textContent = '🔊 Reproduciendo L -> R...';
  await audioEngine.verifyStereoChannels();
  btnTestStereo.textContent = '🎧 Verificar Canales L / R';
});
