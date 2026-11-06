import type { Rating } from 'ts-fsrs';

export type StimulusType = 'lexeme' | 'construction';

export interface ConstructionSlot {
  name: string;
  highlight_start_ms: number;
  highlight_end_ms: number;
}

export interface Stimulus {
  id: string; // e.g. "pseudo_001"
  type: StimulusType;
  target_text: string;
  phonetic_ipa: string;
  pattern: string; // "CVC" | "DISYLLABIC"
  semantic_category: string;
  concreteness_score: number;
  zipf_frequency: number;
  slots?: ConstructionSlot[];
  curation_status: 'draft' | 'approved_by_prof' | 'rejected';
}

export interface FSRSCard {
  cardId: string;
  stimulusId: string;
  stability: number;
  stabilityFast?: number;
  difficulty: number;
  dueAt: string;
  lastReviewAt: string | null;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  scheduleStatus: string;
  reps: number;
  lapses: number;
  scheduledDays: number;
  learningStep: number;
}

export interface SessionInteractionLog {
  id: string;
  sessionId: string;
  stimulusId: string;
  studyMode: 'experimental_study' | 'product_fsrs';
  conditionAssigned: 'prisma_active' | 'passive_restudy';
  trialIndex: number;
  jolRating?: number; // Judgment of Learning 1 a 5
  recallLatencyMs: number; // Tiempo de respuesta
  recallAccuracy: boolean;
  derivedGrade: number; // 1=Again, 2=Hard, 3=Good, 4=Easy
  measuredDriftMs: number;
  displayFpsHz: number;
  deviceAudioLatencyMs: number;
  createdAt: string;
}

export interface SessionMetadata {
  id: string;
  startedAt: string;
  endedAt?: string;
  studyMode: 'experimental_study' | 'product_fsrs';
  totalTrials: number;
  prismaActiveCount: number;
  passiveRestudyCount: number;
  averageLatencyMs: number;
  accuracyRate: number;
}

export interface HardwareLatencyProfile {
  detectedFpsHz: number;
  baseLatencyMs: number;
  outputLatencyMs: number;
  totalHardwareLatencyMs: number;
  isBluetoothSuspected: boolean;
  sampleRate: number;
}

export interface ScheduledStimulus {
  scheduledAudioTime: number;
  estimatedVisualPerfTime: number;
  targetOffsetMs: number;
  duckingDurationSeconds: number;
}

export interface SynchronizationMeasurement {
  trialId: string;
  scheduledAudioTime: number;
  actualVisualPerfTime: number;
  estimatedAudioPerfTime: number;
  measuredDriftMs: number;
  withinTolerance: boolean;
}

export interface GradingResult {
  grade: Rating;
  reason: string;
}
