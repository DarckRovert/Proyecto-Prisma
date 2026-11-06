export type StimulusType = 'lexeme' | 'construction';

export interface ConstructionSlot {
  name: string;
  highlight_start_ms: number;
  highlight_end_ms: number;
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
