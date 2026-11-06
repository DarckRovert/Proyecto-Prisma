/**
 * PrismaDatabase — Capa de persistencia atómica en IndexedDB vía Dexie.js
 * 
 * Gestiona almacenamiento offline-first de estímulos, estados FSRS-7 y telemetría de interacción.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Stimulus, FSRSCard, SessionInteractionLog, SessionMetadata } from './types.ts';

export class PrismaDatabase extends Dexie {
  stimuli!: EntityTable<Stimulus, 'id'>;
  cards!: EntityTable<FSRSCard, 'cardId'>;
  interaction_logs!: EntityTable<SessionInteractionLog, 'id'>;
  sessions!: EntityTable<SessionMetadata, 'id'>;

  constructor() {
    super('PrismaLocalDB');

    this.version(1).stores({
      stimuli: 'id, target_text, pattern, curation_status',
      cards: 'cardId, stimulusId, dueAt, state, scheduleStatus',
      interaction_logs: 'id, sessionId, stimulusId, conditionAssigned, createdAt',
      sessions: 'id, startedAt, studyMode'
    });
  }

  public async seedBatteryIfEmpty(battery: Array<{ id: string; text: string; ipa: string; pattern: string }>): Promise<number> {
    const count = await this.stimuli.count();
    if (count > 0) return count;

    const items: Stimulus[] = battery.map((b) => ({
      id: b.id,
      type: 'lexeme',
      target_text: b.text,
      phonetic_ipa: b.ipa,
      pattern: b.pattern,
      semantic_category: 'pseudowords_study1',
      concreteness_score: 5.0,
      zipf_frequency: 3.0,
      curation_status: 'approved_by_prof'
    }));

    await this.stimuli.bulkAdd(items);
    return items.length;
  }

  public async getCardByStimulusId(stimulusId: string): Promise<FSRSCard | undefined> {
    return this.cards.where('stimulusId').equals(stimulusId).first();
  }

  public async exportAllTelemetry(): Promise<string> {
    const logs = await this.interaction_logs.toArray();
    const sessions = await this.sessions.toArray();
    const cards = await this.cards.toArray();

    const payload = {
      exportTimestamp: new Date().toISOString(),
      schemaVersion: 1,
      totalSessions: sessions.length,
      totalInteractions: logs.length,
      sessions,
      cards,
      logs
    };

    return JSON.stringify(payload, null, 2);
  }
}

export const db = new PrismaDatabase();
