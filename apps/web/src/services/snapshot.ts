/**
 * Badawi Fleet Platform - Web Snapshot Service
 * Ref: ADR-004 (Spark 50k reads limit), D-059 (1-read aggregated fleet view)
 * Ref: T5.6 (Snapshots للقراءة)
 */

import {
  type DailySnapshotDocument,
  loadFleetSnapshot,
  saveFleetSnapshot,
  buildFleetDailySnapshot,
  getOperationalDateString,
  fleetSnapshotCache
} from '@badawi/logic';
import { repositoryService } from './repository';
import { entitiesService } from './entities';

export interface SnapshotServiceState {
  snapshot: DailySnapshotDocument | null;
  loading: boolean;
  error: string | null;
  readCount: number; // Document reads performed (0 if cached, 1 if fetched)
  cacheHit: boolean;
  lastLoadedAt: string | null;
}

type SnapshotListener = (state: SnapshotServiceState) => void;

class WebSnapshotService {
  private state: SnapshotServiceState = {
    snapshot: null,
    loading: false,
    error: null,
    readCount: 0,
    cacheHit: false,
    lastLoadedAt: null
  };

  private listeners = new Set<SnapshotListener>();

  constructor() {
    // Provide default baseline synthetic snapshot if none in repository yet
    this.initDefaultSnapshot();
  }

  private initDefaultSnapshot() {
    const today = getOperationalDateString(new Date());
    const existing = fleetSnapshotCache.get(today);
    if (existing) {
      this.state.snapshot = existing;
      this.state.cacheHit = true;
      this.state.lastLoadedAt = new Date().toISOString();
      return;
    }

    // Baseline fallback snapshot from registered entities
    const vehicles = entitiesService.getVehicles();
    if (vehicles.length > 0) {
      const fallback = buildFleetDailySnapshot({
        operationalDate: today,
        summaries: [],
        targets: vehicles,
        dataSource: 'traccar'
      });
      this.state.snapshot = fallback;
      fleetSnapshotCache.set(today, fallback);
    }
  }

  public getState(): SnapshotServiceState {
    return { ...this.state };
  }

  public subscribe(fn: SnapshotListener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const current = this.getState();
    this.listeners.forEach((fn) => fn(current));
  }

  /**
   * Loads the fleet snapshot with 1 single document read (or 0 reads if in cache).
   */
  public async loadSnapshot(date?: string, forceRefresh = false): Promise<DailySnapshotDocument | null> {
    const targetDate = date || getOperationalDateString(new Date());
    const repo = repositoryService.getRepository();

    this.state.loading = true;
    this.state.error = null;
    this.notify();

    try {
      const cachedBefore = fleetSnapshotCache.get(targetDate);
      const isCached = !forceRefresh && !!cachedBefore;

      const doc = await loadFleetSnapshot(repo, targetDate, { bypassCache: forceRefresh });

      this.state.loading = false;
      this.state.readCount = isCached ? 0 : 1;
      this.state.cacheHit = isCached;
      this.state.lastLoadedAt = new Date().toISOString();

      if (doc) {
        this.state.snapshot = doc;
      } else if (!this.state.snapshot) {
        // Build fresh from current entities if repository has no snapshot yet
        const vehicles = entitiesService.getVehicles();
        const fresh = buildFleetDailySnapshot({
          operationalDate: targetDate,
          summaries: [],
          targets: vehicles,
          dataSource: 'traccar'
        });
        this.state.snapshot = fresh;
        await saveFleetSnapshot(repo, fresh);
      }

      this.notify();
      return this.state.snapshot;
    } catch (err: unknown) {
      this.state.loading = false;
      this.state.error = err instanceof Error ? err.message : String(err);
      this.notify();
      return this.state.snapshot;
    }
  }

  /**
   * Sets or replaces current snapshot in repository and cache.
   */
  public async setSnapshot(snapshot: DailySnapshotDocument): Promise<void> {
    const repo = repositoryService.getRepository();
    await saveFleetSnapshot(repo, snapshot, { forceWrite: true });
    this.state.snapshot = snapshot;
    this.state.lastLoadedAt = new Date().toISOString();
    this.notify();
  }
}

export const webSnapshotService = new WebSnapshotService();
