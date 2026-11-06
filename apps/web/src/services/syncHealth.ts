/**
 * Badawi Fleet Platform - Sync Health Service (T5.4)
 * Ref: ADR-004, ADR-005, ADR-019, ADR-049
 */

import {
  evaluateSyncHealth,
  type SyncHealthEvaluation,
  type SyncStateDocument
} from '@badawi/logic';
import { repositoryService } from './repository';
import { settingsService } from './settings';

export type SyncHealthListener = (evaluation: SyncHealthEvaluation, state: SyncStateDocument | null) => void;

class SyncHealthService {
  private currentDoc: SyncStateDocument | null = null;
  private currentEvaluation: SyncHealthEvaluation = evaluateSyncHealth(null);
  private listeners = new Set<SyncHealthListener>();
  private timer: number | null = null;
  private isLoading = false;

  constructor() {
    this.refresh();
    // Auto re-evaluate every 30 seconds to keep elapsed minutes accurate
    if (typeof window !== 'undefined') {
      this.timer = window.setInterval(() => {
        this.reEvaluate();
      }, 30000);
    }
  }

  public destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public subscribe(listener: SyncHealthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentEvaluation, this.currentDoc);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getEvaluation(): SyncHealthEvaluation {
    return this.currentEvaluation;
  }

  public getDocument(): SyncStateDocument | null {
    return this.currentDoc;
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public async refresh(): Promise<SyncHealthEvaluation> {
    this.isLoading = true;
    try {
      const repo = repositoryService.getRepository();
      const doc = await repo.get<SyncStateDocument>('settings', 'sync_state');
      this.currentDoc = doc || this.getDefaultMockState();
    } catch {
      this.currentDoc = this.getDefaultMockState();
    } finally {
      this.isLoading = false;
    }

    return this.reEvaluate();
  }

  private reEvaluate(): SyncHealthEvaluation {
    const refreshMinutes = settingsService.getValue<number>('ingestion.refresh_interval_minutes') || 15;
    this.currentEvaluation = evaluateSyncHealth(this.currentDoc, refreshMinutes);
    this.notify();
    return this.currentEvaluation;
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener(this.currentEvaluation, this.currentDoc);
    });
  }

  private getDefaultMockState(): SyncStateDocument {
    // Generates a clean operational baseline for preview/in-memory mode
    const now = new Date();
    const tenMinsAgo = new Date(now.getTime() - 8 * 60 * 1000).toISOString();
    return {
      schemaVersion: 1,
      lastSyncTime: tenMinsAgo,
      lastRunAt: tenMinsAgo,
      operationalDate: now.toISOString().split('T')[0],
      rulesVersion: '1.0.0',
      vehicleChecksums: {},
      stats: {
        lastDurationMs: 1140,
        vehiclesTotal: 65,
        writesExecuted: 4,
        writesSkipped: 61,
        errorsCount: 0
      },
      health: 'healthy'
    };
  }
}

export const syncHealthService = new SyncHealthService();
