/**
 * SessionEngine — Orquestador del ciclo de sesión experimental y modo producto
 * 
 * Gestiona asignación contrabalanceada (Prisma Activo vs Re-estudio Pasivo),
 * interleaving buffer (lag 2-4 ítems) y persistencia atómica.
 */

import type { Stimulus, SessionInteractionLog, SessionMetadata } from './types.ts';
import { db } from './db.ts';
import { fsrsEngine } from './fsrs-engine.ts';
import { PrismaAudioEngine } from './audio-engine.ts';
import { VisualRenderer } from './visual-renderer.ts';

export type SessionPhase = 
  | 'idle'
  | 'calibrating'
  | 'fixation'
  | 'exposure'
  | 'jol_prompt'
  | 'testing_active'
  | 'testing_restudy'
  | 'feedback'
  | 'finished';

export interface SessionEventListener {
  onPhaseChange: (phase: SessionPhase, data?: any) => void;
  onProgress: (current: number, total: number) => void;
  onSessionComplete: (metadata: SessionMetadata) => void;
}

export class SessionEngine {
  private audioEngine: PrismaAudioEngine;
  private renderer: VisualRenderer;
  private currentSessionId: string = '';
  private studyMode: 'experimental_study' | 'product_fsrs' = 'experimental_study';
  private currentPhase: SessionPhase = 'idle';

  private stimuliQueue: Array<{
    stimulus: Stimulus;
    condition: 'prisma_active' | 'passive_restudy';
    jolRating?: number;
  }> = [];

  private interleavingBuffer: Array<{
    stimulus: Stimulus;
    condition: 'prisma_active' | 'passive_restudy';
    jolRating?: number;
    exposedAtTrialIndex: number;
  }> = [];

  private trialIndex: number = 0;
  private totalTrials: number = 0;
  private activeCount: number = 0;
  private restudyCount: number = 0;
  private latencies: number[] = [];
  private accuracies: boolean[] = [];
  private listener: SessionEventListener | null = null;

  constructor(audioEngine: PrismaAudioEngine, renderer: VisualRenderer) {
    this.audioEngine = audioEngine;
    this.renderer = renderer;
  }

  public setListener(listener: SessionEventListener): void {
    this.listener = listener;
  }

  public async startSession(
    items: Stimulus[],
    mode: 'experimental_study' | 'product_fsrs' = 'experimental_study'
  ): Promise<void> {
    this.currentSessionId = crypto.randomUUID();
    this.studyMode = mode;
    this.trialIndex = 0;
    this.totalTrials = items.length;
    this.activeCount = 0;
    this.restudyCount = 0;
    this.latencies = [];
    this.accuracies = [];
    this.interleavingBuffer = [];

    // Asignación balanceada 50% Activo, 50% Pasivo (Estudio 1)
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    this.stimuliQueue = shuffled.map((st, idx) => ({
      stimulus: st,
      condition: idx % 2 === 0 ? 'prisma_active' : 'passive_restudy'
    }));

    await db.sessions.put({
      id: this.currentSessionId,
      startedAt: new Date().toISOString(),
      studyMode: this.studyMode,
      totalTrials: this.totalTrials,
      prismaActiveCount: 0,
      passiveRestudyCount: 0,
      averageLatencyMs: 0,
      accuracyRate: 0
    });

    this.processNextStep();
  }

  private setPhase(phase: SessionPhase, data?: any): void {
    this.currentPhase = phase;
    this.listener?.onPhaseChange(phase, data);
  }

  private async processNextStep(): Promise<void> {
    this.listener?.onProgress(this.trialIndex, this.totalTrials);

    // Si hay ítems listos en el buffer de interleaving (lag >= 2)
    const readyFromBuffer = this.interleavingBuffer.find(
      (it) => this.trialIndex - it.exposedAtTrialIndex >= 2
    );

    if (readyFromBuffer) {
      // Extraer y procesar fase de test / re-estudio
      const idx = this.interleavingBuffer.indexOf(readyFromBuffer);
      this.interleavingBuffer.splice(idx, 1);
      this.executeTestingOrRestudy(readyFromBuffer);
      return;
    }

    // Si aún quedan ítems nuevos por exponer
    if (this.stimuliQueue.length > 0) {
      const nextItem = this.stimuliQueue.shift()!;
      this.executeExposure(nextItem);
      return;
    }

    // Si ya no hay ítems nuevos pero quedan ítems en el buffer de interleaving
    if (this.interleavingBuffer.length > 0) {
      const remaining = this.interleavingBuffer.shift()!;
      this.executeTestingOrRestudy(remaining);
      return;
    }

    // Sesión completada
    await this.finishSession();
  }

  private async executeExposure(item: {
    stimulus: Stimulus;
    condition: 'prisma_active' | 'passive_restudy';
  }): Promise<void> {
    this.trialIndex++;
    this.setPhase('fixation');
    this.renderer.drawFixationCross();

    // 1. Fijación durante 300ms
    setTimeout(async () => {
      this.setPhase('exposure', { stimulus: item.stimulus });

      // 2. Programar estímulo audiovisual
      const beep = this.audioEngine.createTestBeepBuffer(600, 0.35);
      const lookaheadMs = 150;
      const scheduled = this.audioEngine.scheduleSynchronizedStimulus(beep, lookaheadMs, 0);

      await this.renderer.scheduleFrameAt(scheduled.estimatedVisualPerfTime, () => {
        this.renderer.drawStimulus(null, item.stimulus.target_text, item.stimulus.phonetic_ipa);
      });

      // 3. Exposición durante 2200ms
      setTimeout(() => {
        this.renderer.drawFixationCross();
        // 4. Solicitar Juicio de Aprendizaje (JOL)
        this.setPhase('jol_prompt', {
          stimulus: item.stimulus,
          onSubmitJol: (rating: number) => {
            // Guardar en buffer de interleaving
            this.interleavingBuffer.push({
              stimulus: item.stimulus,
              condition: item.condition,
              jolRating: rating,
              exposedAtTrialIndex: this.trialIndex
            });
            this.processNextStep();
          }
        });
      }, 2200);
    }, 300);
  }

  private async executeTestingOrRestudy(item: {
    stimulus: Stimulus;
    condition: 'prisma_active' | 'passive_restudy';
    jolRating?: number;
  }): Promise<void> {
    if (item.condition === 'prisma_active') {
      this.activeCount++;
      const startTime = performance.now();
      this.setPhase('testing_active', {
        stimulus: item.stimulus,
        onAnswer: async (userInput: string) => {
          const latencyMs = Math.round(performance.now() - startTime);
          const accuracy = userInput.trim().toLowerCase() === item.stimulus.target_text.toLowerCase();

          this.latencies.push(latencyMs);
          this.accuracies.push(accuracy);

          // Calificación objetiva FSRS
          const gradeResult = fsrsEngine.calculateObjectiveGrade(accuracy, latencyMs);

          // Persistir interacción atómica
          const log: SessionInteractionLog = {
            id: crypto.randomUUID(),
            sessionId: this.currentSessionId,
            stimulusId: item.stimulus.id,
            studyMode: this.studyMode,
            conditionAssigned: 'prisma_active',
            trialIndex: this.trialIndex,
            jolRating: item.jolRating,
            recallLatencyMs: latencyMs,
            recallAccuracy: accuracy,
            derivedGrade: gradeResult.grade,
            measuredDriftMs: 0,
            displayFpsHz: this.renderer.getDetectedFps(),
            deviceAudioLatencyMs: this.audioEngine.getHardwareProfile().totalHardwareLatencyMs,
            createdAt: new Date().toISOString()
          };
          await db.interaction_logs.put(log);

          // Actualizar estado FSRS si corresponde
          await fsrsEngine.reviewStimulus(item.stimulus.id, gradeResult.grade);

          // Feedback visual correctivo
          this.setPhase('feedback', { accuracy, stimulus: item.stimulus, gradeResult });
          this.renderer.drawStimulus(null, item.stimulus.target_text, item.stimulus.phonetic_ipa);

          setTimeout(() => {
            this.renderer.drawFixationCross();
            this.processNextStep();
          }, 600);
        }
      });
    } else {
      // Condición Control: Re-estudio Pasivo (Tiempo Igualado a la media del activo ~1500ms)
      this.restudyCount++;
      this.setPhase('testing_restudy', { stimulus: item.stimulus });

      const beep = this.audioEngine.createTestBeepBuffer(600, 0.35);
      const scheduled = this.audioEngine.scheduleSynchronizedStimulus(beep, 120, 0);

      await this.renderer.scheduleFrameAt(scheduled.estimatedVisualPerfTime, () => {
        this.renderer.drawStimulus(null, item.stimulus.target_text, item.stimulus.phonetic_ipa);
      });

      setTimeout(async () => {
        const log: SessionInteractionLog = {
          id: crypto.randomUUID(),
          sessionId: this.currentSessionId,
          stimulusId: item.stimulus.id,
          studyMode: this.studyMode,
          conditionAssigned: 'passive_restudy',
          trialIndex: this.trialIndex,
          jolRating: item.jolRating,
          recallLatencyMs: 1500, // Tiempo de re-exposición pasiva estandarizado
          recallAccuracy: true,
          derivedGrade: 3, // Good por defecto en re-exposición
          measuredDriftMs: 0,
          displayFpsHz: this.renderer.getDetectedFps(),
          deviceAudioLatencyMs: this.audioEngine.getHardwareProfile().totalHardwareLatencyMs,
          createdAt: new Date().toISOString()
        };
        await db.interaction_logs.put(log);

        this.renderer.drawFixationCross();
        this.processNextStep();
      }, 1500);
    }
  }

  private async finishSession(): Promise<void> {
    this.setPhase('finished');

    const avgLat = this.latencies.length > 0
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : 0;

    const accRate = this.accuracies.length > 0
      ? Math.round((this.accuracies.filter(Boolean).length / this.accuracies.length) * 100) / 100
      : 0;

    const metadata: SessionMetadata = {
      id: this.currentSessionId,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      studyMode: this.studyMode,
      totalTrials: this.totalTrials,
      prismaActiveCount: this.activeCount,
      passiveRestudyCount: this.restudyCount,
      averageLatencyMs: avgLat,
      accuracyRate: accRate
    };

    await db.sessions.put(metadata);
    this.listener?.onSessionComplete(metadata);
  }

  public getCurrentPhase(): SessionPhase {
    return this.currentPhase;
  }
}
