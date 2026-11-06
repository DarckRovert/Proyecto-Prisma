/**
 * FSRSEngine — Envoltorio de FSRS-7 y algoritmo de calificación automática por latencia
 */

import { DefaultScheduler, Rating } from 'ts-fsrs';
import type { FSRSCard, GradingResult } from './types.ts';
import { db } from './db.ts';

type AppScheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
type ReviewGrade = 1 | 2 | 3 | 4;

export class FSRSEngine {
  private scheduler: AppScheduler | null = null;
  private isInitialized: boolean = false;

  public async initialize(): Promise<AppScheduler> {
    if (this.isInitialized && this.scheduler) return this.scheduler;
    this.scheduler = await DefaultScheduler();
    this.isInitialized = true;
    return this.scheduler;
  }

  public async createCardForStimulus(stimulusId: string): Promise<FSRSCard> {
    const scheduler = await this.initialize();
    const now = new Date();
    const rawCard = scheduler.newCard({ now });

    const fsrsCard: FSRSCard = {
      cardId: String(rawCard.cardId || crypto.randomUUID()),
      stimulusId,
      stability: rawCard.stability,
      difficulty: rawCard.difficulty,
      dueAt: rawCard.dueAt instanceof Date ? rawCard.dueAt.toISOString() : String(rawCard.dueAt || now.toISOString()),
      lastReviewAt: null,
      state: rawCard.state,
      scheduleStatus: rawCard.scheduleStatus,
      reps: rawCard.reps,
      lapses: rawCard.lapses,
      scheduledDays: rawCard.scheduledDays,
      learningStep: rawCard.learningStep
    };

    await db.cards.put(fsrsCard);
    return fsrsCard;
  }

  /**
   * Mapeo objetivo de calificación FSRS basado en precisión y percentiles de latencia
   */
  public calculateObjectiveGrade(
    accuracy: boolean,
    latencyMs: number,
    p25LatencyMs: number = 800,
    p75LatencyMs: number = 2200
  ): GradingResult {
    if (!accuracy) {
      return {
        grade: Rating.Again,
        reason: 'Recuperación fallida (Again)'
      };
    }

    if (latencyMs > p75LatencyMs) {
      return {
        grade: Rating.Hard,
        reason: `Acierto con vacilación prolongada (${latencyMs}ms > P75 ${p75LatencyMs}ms)`
      };
    }

    if (latencyMs < p25LatencyMs) {
      return {
        grade: Rating.Easy,
        reason: `Acierto con fluidez óptima (${latencyMs}ms < P25 ${p25LatencyMs}ms)`
      };
    }

    return {
      grade: Rating.Good,
      reason: `Acierto dentro de ventana normal (${latencyMs}ms)`
    };
  }

  public async reviewStimulus(
    stimulusId: string,
    grade: Rating,
    now: Date = new Date()
  ): Promise<FSRSCard> {
    const scheduler = await this.initialize();

    let card = await db.getCardByStimulusId(stimulusId);
    if (!card) {
      card = await this.createCardForStimulus(stimulusId);
    }

    // Convertir para el scheduler v6
    const cardInput: any = {
      ...card,
      dueAt: new Date(card.dueAt),
      lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null
    };

    // Asegurar que el grado sea un ReviewGrade válido (1, 2, 3, 4)
    const validGrade: ReviewGrade = (grade === Rating.Manual ? Rating.Good : grade) as ReviewGrade;

    const reviewResult = scheduler.review({
      card: cardInput,
      grade: validGrade,
      now
    });

    const updatedRaw = reviewResult.card;
    const updatedCard: FSRSCard = {
      ...card,
      stability: updatedRaw.stability,
      difficulty: updatedRaw.difficulty,
      dueAt: updatedRaw.dueAt instanceof Date ? updatedRaw.dueAt.toISOString() : String(updatedRaw.dueAt),
      lastReviewAt: now.toISOString(),
      state: updatedRaw.state,
      scheduleStatus: updatedRaw.scheduleStatus,
      reps: updatedRaw.reps,
      lapses: updatedRaw.lapses,
      scheduledDays: updatedRaw.scheduledDays,
      learningStep: updatedRaw.learningStep
    };

    await db.cards.put(updatedCard);
    return updatedCard;
  }
}

export const fsrsEngine = new FSRSEngine();
