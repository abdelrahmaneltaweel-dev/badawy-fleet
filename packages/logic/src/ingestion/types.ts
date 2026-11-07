/**
 * Badawi Fleet Platform - Ingestion Worker Types (T5.2)
 * Ref: ADR-004 (Spark Free Plan Quota Protection), ADR-005 (Actions Worker)
 * Ref: ADR-019 (GPS Issues Lifecycle), ADR-023 (Traccar 12M Window)
 * Ref: ADR-049 (Refresh Rate Write Guard)
 */

import type { DailySummaryDocument, IssueDocument, VehicleType } from '../schema/types.js';

export interface VehicleSyncTarget {
  deviceId: number;
  vehicleId: string;
  vehicleType: VehicleType | string;
  driverId?: string | null;
  name?: string;
}

export interface VehicleSyncResult {
  vehicleId: string;
  deviceId: number;
  changed: boolean;
  checksum: string;
  previousChecksum?: string;
  tripsCount: number;
  stopsCount: number;
  rawPointsCount: number;
  hasIssue: boolean;
  issueType?: string;
  error?: string;
}

export interface IngestionStats {
  operationalDate: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  vehiclesTotal: number;
  vehiclesProcessed: number;
  writesExecuted: number;
  writesSkipped: number;
  writesSavedPercent: number;
  dailySparkBudgetRemaining: number; // Remaining writes out of 20,000
  errorsCount: number;
  issuesDetected: number;
}

export interface SyncStateDocument {
  schemaVersion: number;
  lastSyncTime: string; // ISO timestamp of newest GPS ping ingested
  lastRunAt: string; // ISO timestamp of worker execution
  operationalDate: string; // YYYY-MM-DD
  rulesVersion: string;
  vehicleChecksums: Record<string, string>; // vehicleId -> checksum
  stats: {
    lastDurationMs: number;
    vehiclesTotal: number;
    writesExecuted: number;
    writesSkipped: number;
    errorsCount: number;
  };
  health: 'healthy' | 'degraded' | 'error';
  errorMessage?: string;
}

export interface IngestionOptions {
  operationalDate?: string; // YYYY-MM-DD (defaults to current operational day from 6 AM)
  referenceNow?: Date | string;
  forceAllWrites?: boolean; // When true, bypasses checksum diff and rewrites all (e.g. migration)
  dryRun?: boolean; // Analyzes and calculates diffs without executing database writes
  batchSize?: number; // Concurrency limit for Traccar pulls (Default: 5)
  delayBetweenBatchesMs?: number; // Throttle sleep between batches (Default: 300ms)
}

export interface IngestionExecutionResult {
  ok: boolean;
  stats: IngestionStats;
  vehicleResults: VehicleSyncResult[];
  syncState: SyncStateDocument;
  createdSummaries: DailySummaryDocument[];
  createdIssues: IssueDocument[];
  dailySnapshot?: import('../schema/types.js').DailySnapshotDocument;
  error?: string;
}

