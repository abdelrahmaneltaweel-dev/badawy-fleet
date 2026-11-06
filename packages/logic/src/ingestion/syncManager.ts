/**
 * Badawi Fleet Platform - Ingestion Sync Manager
 * Ref: ADR-004 (Firebase Spark Plan Quota Protection), ADR-005 (Actions Worker)
 * Ref: ADR-019 (GPS Issues Lifecycle), ADR-023 (Traccar Read-Only 12-Month Ingestion Window)
 * Ref: ADR-049 (Refresh Rate Write Guard)
 */

import type { IDataRepository } from '../repository/types.js';
import type { TraccarClient } from '../traccar/client.js';
import type { Geofence, AnalysisConfig } from '../analysis/types.js';
import { analyzeVehicleDailyData, getOperationalDateString } from '../analysis/pipeline.js';
import { computeSummaryChecksum, hasSummaryChanged } from './checksum.js';
import type {
  VehicleSyncTarget,
  VehicleSyncResult,
  IngestionStats,
  SyncStateDocument,
  IngestionOptions,
  IngestionExecutionResult
} from './types.js';
import type { DailySummaryDocument, IssueDocument, VehicleType, IssueType, DataSourceType } from '../schema/types.js';

import { SPARK_DAILY_WRITE_LIMIT } from './budget.js';

export const SYNC_STATE_DOC_ID = 'sync_state';
export { SPARK_DAILY_WRITE_LIMIT };

export function convertAnalysisToDailySummary(
  analysis: ReturnType<typeof analyzeVehicleDailyData>,
  driverId: string | null = null,
  dataSource: DataSourceType = 'traccar'
): DailySummaryDocument {
  const isTractor = 
    analysis.vehicleType === 'tractor' || 
    analysis.vehicleType === 'جرار' || 
    analysis.vehicleType === 'dump_truck';

  const trips = isTractor
    ? analysis.hauls.map((h) => ({
        start: h.startTime || analysis.operationalDate,
        end: h.endTime || analysis.operationalDate,
        origin: 'الخلاطة (محطة الخلط)',
        destination: 'الكسارة / موقع الصب',
        durationMinutes: h.durationMinutes
      }))
    : analysis.trips.map((t) => ({
        start: t.startTime,
        end: t.endTime,
        origin: t.startLocation.name || 'نقطة الانطلاق',
        destination: t.endLocation.name || 'نقطة الوصول',
        durationMinutes: t.durationMinutes
      }));

  const stops = analysis.stops.map((s) => ({
    location: s.geofenceName || (s.isMaintenance ? 'الجراج (صيانة)' : 'وقفة تشغيلية'),
    start: s.startTime,
    end: s.endTime,
    durationMinutes: s.durationMinutes
  }));

  const now = new Date().toISOString();
  const summaryId = `${analysis.operationalDate}_${analysis.vehicleId}`;

  // Normalize vehicleType for schema enum
  let normalizedType: VehicleType = 'tractor';
  if (analysis.vehicleType === 'transport' || analysis.vehicleType === 'truck' || analysis.vehicleType === 'نقل') {
    normalizedType = 'truck';
  } else if (analysis.vehicleType === 'passenger' || analysis.vehicleType === 'private' || analysis.vehicleType === 'ملاكي') {
    normalizedType = 'private';
  }

  return {
    schemaVersion: 1,
    summaryId,
    date: analysis.operationalDate,
    vehicleId: analysis.vehicleId,
    driverId: driverId || null,
    vehicleType: normalizedType,
    tripsCount: trips.length,
    trips,
    stopsCount: stops.length,
    stops,
    firstMovement: analysis.cleanPointsCount > 0 ? analysis.stops[0]?.startTime || null : null,
    lastMovement: analysis.cleanPointsCount > 0 ? analysis.stops[analysis.stops.length - 1]?.endTime || null : null,
    matchingStatus: 'pending',
    rulesVersion: analysis.metadata.rulesVersion,
    dataSource,
    createdAt: now,
    updatedAt: now
  };
}

export function detectGpsIssueFromAnalysis(
  analysis: ReturnType<typeof analyzeVehicleDailyData>
): IssueDocument | null {
  const { gpsStatus } = analysis;
  if (!gpsStatus.hasActiveIssue) {
    return null;
  }

  const now = new Date().toISOString();
  let issueType: IssueType = 'other';
  if (gpsStatus.status === 'offline') {
    issueType = 'offline';
  } else if (gpsStatus.status === 'frozen_signal') {
    issueType = 'frozen_signal';
  }

  return {
    schemaVersion: 1,
    issueId: `issue_${analysis.vehicleId}_${analysis.operationalDate}`,
    vehicleId: analysis.vehicleId,
    type: issueType,
    detectedAt: gpsStatus.lastPingTime || now,
    status: 'open',
    resolvedAt: null,
    notes: gpsStatus.issueDetails || `تم رصد مشكلة ${gpsStatus.status} تلقائياً أثناء المزامنة`,
    createdAt: now,
    updatedAt: now
  };
}

export class IngestionManager {
  private traccarClient: TraccarClient;
  private repository: IDataRepository;
  private geofences: Geofence[];
  private analysisConfig?: Partial<AnalysisConfig>;

  constructor(
    traccarClient: TraccarClient,
    repository: IDataRepository,
    geofences: Geofence[] = [],
    analysisConfig?: Partial<AnalysisConfig>
  ) {
    this.traccarClient = traccarClient;
    this.repository = repository;
    this.geofences = geofences;
    this.analysisConfig = analysisConfig;
  }

  /**
   * Helper to write or update a document in IDataRepository.
   */
  private async saveDoc<T extends { schemaVersion?: number }>(
    collection: 'settings' | 'daily_summaries' | 'issues',
    id: string,
    data: T
  ): Promise<void> {
    const existing = await this.repository.get(collection, id);
    if (existing) {
      await this.repository.update(collection, id, data);
    } else {
      await this.repository.create(collection, id, data);
    }
  }

  /**
   * Retrieves the current persistent sync state from the repository.
   */
  public async loadSyncState(): Promise<SyncStateDocument> {
    try {
      const doc = await this.repository.get<{ data?: Record<string, unknown> }>(
        'settings',
        SYNC_STATE_DOC_ID
      );
      if (doc?.data && typeof doc.data === 'object' && 'vehicleChecksums' in doc.data) {
        return doc.data as unknown as SyncStateDocument;
      }
    } catch {
      // Document may not exist on initial run
    }

    // Default baseline sync state
    return {
      schemaVersion: 1,
      lastSyncTime: new Date(0).toISOString(),
      lastRunAt: new Date(0).toISOString(),
      operationalDate: getOperationalDateString(new Date()),
      rulesVersion: '1.0.0',
      vehicleChecksums: {},
      stats: {
        lastDurationMs: 0,
        vehiclesTotal: 0,
        writesExecuted: 0,
        writesSkipped: 0,
        errorsCount: 0
      },
      health: 'healthy'
    };
  }

  /**
   * Saves updated sync state to repository wrapped as valid SettingsDocument.
   */
  public async saveSyncState(state: SyncStateDocument): Promise<void> {
    const now = new Date().toISOString();
    const settingsPayload = {
      schemaVersion: 1,
      settingId: SYNC_STATE_DOC_ID,
      version: 1,
      updatedBy: 'worker',
      data: { ...state } as Record<string, unknown>,
      createdAt: now,
      updatedAt: now
    };
    await this.saveDoc('settings', SYNC_STATE_DOC_ID, settingsPayload);
  }

  /**
   * Orchestrates full ingestion cycle for fleet vehicles.
   */
  public async runIngestion(
    targets: VehicleSyncTarget[],
    options: IngestionOptions = {}
  ): Promise<IngestionExecutionResult> {
    const startTime = new Date();
    const referenceNow = options.referenceNow ? new Date(options.referenceNow) : new Date();
    const operationalDate = options.operationalDate || getOperationalDateString(referenceNow);

    // 1. Load previous state
    const previousState = await this.loadSyncState();
    const isNewOperationalDay = previousState.operationalDate !== operationalDate;

    // Reset vehicle checksums if operational day has rolled over
    const activeChecksums = isNewOperationalDay ? {} : { ...previousState.vehicleChecksums };

    // 2. Determine time window: from 06:00 AM of operational day to referenceNow
    const fromTime = new Date(`${operationalDate}T06:00:00.000Z`);
    const toTime = referenceNow;

    // 3. Batch pull raw positions from Traccar with throttling (T5.1)
    const deviceList = targets.map((t) => ({
      deviceId: t.deviceId,
      vehicleId: t.vehicleId
    }));

    const positionsMap = await this.traccarClient.getPositionsBatch({
      devices: deviceList,
      from: fromTime,
      to: toTime,
      batchSize: options.batchSize || 5,
      delayBetweenBatchesMs: options.delayBetweenBatchesMs ?? 100
    });

    const vehicleResults: VehicleSyncResult[] = [];
    const createdSummaries: DailySummaryDocument[] = [];
    const createdIssues: IssueDocument[] = [];

    let writesExecuted = 0;
    let writesSkipped = 0;
    let errorsCount = 0;
    let newestPingTime = previousState.lastSyncTime;

    // 4. Process each vehicle with analysis pipeline and evaluate diff
    for (const target of targets) {
      try {
        const rawPoints = positionsMap.get(target.vehicleId) || [];

        // Track newest ping timestamp
        for (const pt of rawPoints) {
          const tStr = typeof pt.timestamp === 'string' ? pt.timestamp : new Date(pt.timestamp).toISOString();
          if (!newestPingTime || tStr > newestPingTime) {
            newestPingTime = tStr;
          }
        }

        // Run pure analysis pipeline (T4.1)
        const analysis = analyzeVehicleDailyData(
          { id: target.vehicleId, type: target.vehicleType, name: target.name },
          rawPoints,
          this.geofences,
          operationalDate,
          referenceNow,
          this.analysisConfig
        );

        // Compute deterministic checksum (T5.2)
        const newChecksum = computeSummaryChecksum(analysis);
        const prevChecksum = activeChecksums[target.vehicleId];
        const changed = hasSummaryChanged(prevChecksum, newChecksum, options.forceAllWrites);

        const summaryDoc = convertAnalysisToDailySummary(analysis, target.driverId);
        const issueDoc = detectGpsIssueFromAnalysis(analysis);

        if (changed) {
          if (!options.dryRun) {
            // Write daily summary document
            await this.saveDoc('daily_summaries', summaryDoc.summaryId, summaryDoc);
            writesExecuted++;
          }
          activeChecksums[target.vehicleId] = newChecksum;
          createdSummaries.push(summaryDoc);
        } else {
          writesSkipped++;
        }

        // Issue handling: Write ONLY if issue is new or changed, not if already recorded as open
        if (issueDoc) {
          createdIssues.push(issueDoc);
          if (!options.dryRun) {
            const existingIssue = await this.repository.get<IssueDocument>('issues', issueDoc.issueId);
            if (!existingIssue || existingIssue.status !== 'open') {
              await this.saveDoc('issues', issueDoc.issueId, issueDoc);
              writesExecuted++;
            }
          }
        }

        vehicleResults.push({
          vehicleId: target.vehicleId,
          deviceId: target.deviceId,
          changed,
          checksum: newChecksum,
          previousChecksum: prevChecksum,
          tripsCount: summaryDoc.tripsCount,
          stopsCount: summaryDoc.stopsCount,
          rawPointsCount: rawPoints.length,
          hasIssue: !!issueDoc,
          issueType: issueDoc?.type
        });
      } catch (err: unknown) {
        errorsCount++;
        vehicleResults.push({
          vehicleId: target.vehicleId,
          deviceId: target.deviceId,
          changed: false,
          checksum: '',
          tripsCount: 0,
          stopsCount: 0,
          rawPointsCount: 0,
          hasIssue: true,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const totalProcessed = targets.length;
    const totalPotentialWrites = totalProcessed; // 1 summary write per vehicle
    const writesSavedPercent = totalPotentialWrites > 0
      ? Math.round((writesSkipped / totalPotentialWrites) * 1000) / 10
      : 100;

    // 5. Update and persist sync state
    const nextSyncState: SyncStateDocument = {
      schemaVersion: 1,
      lastSyncTime: newestPingTime,
      lastRunAt: endTime.toISOString(),
      operationalDate,
      rulesVersion: this.analysisConfig?.rulesVersion || '1.0.0',
      vehicleChecksums: activeChecksums,
      stats: {
        lastDurationMs: durationMs,
        vehiclesTotal: totalProcessed,
        writesExecuted,
        writesSkipped,
        errorsCount
      },
      health: errorsCount > 0 ? (errorsCount < totalProcessed ? 'degraded' : 'error') : 'healthy'
    };

    if (!options.dryRun) {
      // 1 write for the sync state document
      await this.saveSyncState(nextSyncState);
      writesExecuted++;
    }

    const stats: IngestionStats = {
      operationalDate,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      vehiclesTotal: totalProcessed,
      vehiclesProcessed: totalProcessed - errorsCount,
      writesExecuted,
      writesSkipped,
      writesSavedPercent,
      dailySparkBudgetRemaining: Math.max(0, SPARK_DAILY_WRITE_LIMIT - writesExecuted),
      errorsCount,
      issuesDetected: createdIssues.length
    };

    return {
      ok: errorsCount === 0,
      stats,
      vehicleResults,
      syncState: nextSyncState,
      createdSummaries,
      createdIssues
    };
  }
}
