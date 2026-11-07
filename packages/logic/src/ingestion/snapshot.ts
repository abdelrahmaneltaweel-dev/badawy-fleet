/**
 * Badawi Fleet Platform - Low-Read Daily Snapshot Engine
 * Ref: ADR-004 (Firebase Spark Quota Protection: 50,000 Reads & 20,000 Writes/Day)
 * Ref: D-059 (Six Dashboard Cards & 1-Read Aggregated Fleet Snapshots)
 * Ref: T5.6 (Snapshots للقراءة: قراءات قليلة)
 */

import type { IDataRepository } from '../repository/types.js';
import type {
  DailySnapshotDocument,
  DailySummaryDocument,
  VehicleSnapshotItem,
  IssueSnapshotItem,
  FleetTotals,
  IssueDocument,
  VehicleType,
  VehicleStatus,
  DataSourceType
} from '../schema/types.js';
import type { VehicleSyncTarget } from './types.js';
import { fnv1aHex } from './checksum.js';

export interface BuildSnapshotParams {
  operationalDate: string;
  summaries: DailySummaryDocument[];
  targets?: (VehicleSyncTarget | { vehicleId: string; name?: string; type?: string; plateNumber?: string; status?: string })[];
  issues?: IssueDocument[];
  driverNames?: Record<string, string>;
  rulesVersion?: string;
  dataSource?: DataSourceType;
  referenceNow?: Date | string;
  snapshotId?: string;
}

export interface SaveSnapshotResult {
  written: boolean;
  skipped: boolean;
  checksum: string;
  previousChecksum: string | null;
}

/**
 * Computes deterministic FNV-1a checksum over core snapshot metrics.
 */
export function computeSnapshotChecksum(
  totals: FleetTotals,
  vehicles: VehicleSnapshotItem[],
  issues: IssueSnapshotItem[]
): string {
  const parts: string[] = [
    `v:${totals.totalVehicles}`,
    `on:${totals.onlineCount}`,
    `off:${totals.offlineCount}`,
    `idl:${totals.idleCount}`,
    `trips:${totals.totalTrips}`,
    `trac:${totals.tractorTrips}`,
    `truck:${totals.truckTrips}`,
    `priv:${totals.privateTrips}`,
    `stops:${totals.totalStops}`,
    `maint:${totals.maintenanceStops}`,
    `iss:${totals.activeIssuesCount}`
  ];

  // Deterministically sort and append vehicle metrics
  const sortedVehicles = [...vehicles].sort((a, b) => a.vehicleId.localeCompare(b.vehicleId, undefined, { numeric: true }));
  for (const v of sortedVehicles) {
    parts.push(`v[${v.vehicleId}|${v.status}|t:${v.tripsCount}|s:${v.stopsCount}|i:${v.hasIssue ? 1 : 0}]`);
  }

  // Append sorted open issue IDs
  const sortedIssues = [...issues].sort((a, b) => a.issueId.localeCompare(b.issueId));
  for (const iss of sortedIssues) {
    parts.push(`iss[${iss.issueId}|${iss.type}|${iss.status}]`);
  }

  return fnv1aHex(parts.join(';'));
}

/**
 * Builds a compact, complete DailySnapshotDocument from fleet summaries, vehicle targets, and issues.
 */
export function buildFleetDailySnapshot(params: BuildSnapshotParams): DailySnapshotDocument {
  const now = params.referenceNow ? new Date(params.referenceNow).toISOString() : new Date().toISOString();
  const date = params.operationalDate;
  const snapshotId = params.snapshotId || date;
  const rulesVersion = params.rulesVersion || '1.0.0';
  const dataSource: DataSourceType = params.dataSource || 'traccar';

  // Map summaries by vehicleId for quick access
  const summaryByVehicle = new Map<string, DailySummaryDocument>();
  for (const s of params.summaries) {
    summaryByVehicle.set(s.vehicleId, s);
  }

  // Map issues by vehicleId
  const issuesByVehicle = new Map<string, IssueDocument>();
  const activeIssues: IssueDocument[] = [];
  if (params.issues) {
    for (const iss of params.issues) {
      if (iss.status === 'open' || iss.status === 'contacted') {
        issuesByVehicle.set(iss.vehicleId, iss);
        activeIssues.push(iss);
      }
    }
  }

  // Build target vehicle index
  const vehicleList = params.targets && params.targets.length > 0
    ? params.targets
    : params.summaries.map((s) => ({
        vehicleId: s.vehicleId,
        name: `عربية ${s.vehicleId}`,
        type: s.vehicleType,
        plateNumber: '',
        status: s.tripsCount > 0 ? 'online' : 'idle'
      }));

  let onlineCount = 0;
  let offlineCount = 0;
  let idleCount = 0;
  let totalTrips = 0;
  let tractorTrips = 0;
  let truckTrips = 0;
  let privateTrips = 0;
  let totalStops = 0;
  let maintenanceStops = 0;

  const vehicleItems: VehicleSnapshotItem[] = [];

  for (const target of vehicleList) {
    const vId = target.vehicleId;
    const summary = summaryByVehicle.get(vId);
    const issue = issuesByVehicle.get(vId);

    // Normalize type
    let normalizedType: VehicleType = 'tractor';
    const rawType = ('vehicleType' in target ? (target as VehicleSyncTarget).vehicleType : target.type) || summary?.vehicleType || 'tractor';
    if (rawType === 'truck' || rawType === 'transport' || rawType === 'نقل') {
      normalizedType = 'truck';
    } else if (rawType === 'private' || rawType === 'passenger' || rawType === 'ملاكي') {
      normalizedType = 'private';
    }

    // Determine status
    let status: VehicleStatus = 'online';
    const targetStatus = 'status' in target ? (target as { status?: string }).status : undefined;
    if (issue?.type === 'offline') {
      status = 'offline';
    } else if (targetStatus === 'offline') {
      status = 'offline';
    } else if (!summary || (summary.tripsCount === 0 && summary.stopsCount === 0)) {
      status = 'idle';
    } else {
      status = 'online';
    }

    if (status === 'online') onlineCount++;
    else if (status === 'offline') offlineCount++;
    else idleCount++;

    const tripsCount = summary ? summary.tripsCount : 0;
    const stopsCount = summary ? summary.stopsCount : 0;
    totalTrips += tripsCount;
    totalStops += stopsCount;

    if (normalizedType === 'tractor') tractorTrips += tripsCount;
    else if (normalizedType === 'truck') truckTrips += tripsCount;
    else privateTrips += tripsCount;

    // Check maintenance stops
    if (summary && summary.stops) {
      for (const st of summary.stops) {
        if (st.location.includes('صيانة') || st.location.includes('الجراج')) {
          maintenanceStops++;
        }
      }
    }

    const driverId = summary?.driverId || ('driverId' in target ? (target as { driverId?: string }).driverId : null) || null;
    const driverName = driverId && params.driverNames ? params.driverNames[driverId] : undefined;
    const targetPlate = 'plateNumber' in target ? (target as { plateNumber?: string }).plateNumber || '' : '';

    const lastLoc = summary && summary.stops.length > 0
      ? summary.stops[summary.stops.length - 1].location
      : undefined;

    vehicleItems.push({
      vehicleId: vId,
      name: target.name || `عربية ${vId}`,
      type: normalizedType,
      plateNumber: targetPlate,
      status,
      tripsCount,
      stopsCount,
      firstMovement: summary?.firstMovement || null,
      lastMovement: summary?.lastMovement || null,
      lastLocationName: lastLoc,
      driverId,
      driverName,
      matchingStatus: summary?.matchingStatus || 'pending',
      hasIssue: !!issue,
      issueType: issue?.type,
      dataSource: summary?.dataSource || dataSource,
      updatedAt: summary?.updatedAt || now
    });
  }

  // Sort vehicles deterministically
  vehicleItems.sort((a, b) => a.vehicleId.localeCompare(b.vehicleId, undefined, { numeric: true }));

  const recentIssues: IssueSnapshotItem[] = activeIssues.map((iss) => ({
    issueId: iss.issueId,
    vehicleId: iss.vehicleId,
    type: iss.type,
    detectedAt: iss.detectedAt,
    status: iss.status,
    notes: iss.notes,
    driverId: iss.driverId || null,
    driverName: iss.driverName || (iss.driverId && params.driverNames ? params.driverNames[iss.driverId] : undefined),
    driverPhone: iss.driverPhone,
    contactedAt: iss.contactedAt,
    resolvedAt: iss.resolvedAt,
    offlineMinutes: iss.offlineMinutes
  }));

  const fleetTotals: FleetTotals = {
    totalVehicles: vehicleList.length,
    onlineCount,
    offlineCount,
    idleCount,
    totalTrips,
    tractorTrips,
    truckTrips,
    privateTrips,
    totalStops,
    maintenanceStops,
    activeIssuesCount: recentIssues.length
  };

  const checksum = computeSnapshotChecksum(fleetTotals, vehicleItems, recentIssues);

  return {
    schemaVersion: 1,
    snapshotId,
    date,
    fleetTotals,
    vehicles: vehicleItems,
    recentIssues,
    checksum,
    rulesVersion,
    dataSource,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * In-memory client & worker cache with TTL to guarantee 0 Firestore Reads on repeated visits.
 */
class SnapshotCacheManager {
  private cache = new Map<string, { doc: DailySnapshotDocument; expiresAt: number }>();
  public defaultTtlMs = 120_000; // 2 minutes

  public get(key: string): DailySnapshotDocument | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.doc;
  }

  public set(key: string, doc: DailySnapshotDocument, ttlMs = this.defaultTtlMs): void {
    this.cache.set(key, {
      doc,
      expiresAt: Date.now() + ttlMs
    });
  }

  public invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const fleetSnapshotCache = new SnapshotCacheManager();

/**
 * Persists the fleet daily snapshot to Firestore / Repository with write-diff checking.
 * If the snapshot content has not changed from the saved document, the write is SKIPPED to save Spark writes!
 */
export async function saveFleetSnapshot(
  repository: IDataRepository,
  snapshot: DailySnapshotDocument,
  options: { forceWrite?: boolean } = {}
): Promise<SaveSnapshotResult> {
  const existing = await repository.get<DailySnapshotDocument>('daily_snapshots', snapshot.snapshotId);
  const previousChecksum = existing?.checksum || null;

  // Diff check: skip write if unchanged
  if (!options.forceWrite && existing && existing.checksum === snapshot.checksum) {
    // Keep local cache warm
    fleetSnapshotCache.set(snapshot.snapshotId, snapshot);
    return {
      written: false,
      skipped: true,
      checksum: snapshot.checksum,
      previousChecksum
    };
  }

  if (existing) {
    await repository.update('daily_snapshots', snapshot.snapshotId, snapshot);
  } else {
    await repository.create('daily_snapshots', snapshot.snapshotId, snapshot);
  }

  // Update in-memory cache
  fleetSnapshotCache.set(snapshot.snapshotId, snapshot);

  return {
    written: true,
    skipped: false,
    checksum: snapshot.checksum,
    previousChecksum
  };
}

/**
 * Loads the fleet daily snapshot with 1 single Firestore read (or 0 reads if in cache).
 */
export async function loadFleetSnapshot(
  repository: IDataRepository,
  dateOrId: string,
  options: { bypassCache?: boolean } = {}
): Promise<DailySnapshotDocument | null> {
  if (!options.bypassCache) {
    const cached = fleetSnapshotCache.get(dateOrId);
    if (cached) {
      return cached;
    }
  }

  const doc = await repository.get<DailySnapshotDocument>('daily_snapshots', dateOrId);
  if (doc) {
    fleetSnapshotCache.set(dateOrId, doc);
  }
  return doc;
}
