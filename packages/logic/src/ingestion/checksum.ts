/**
 * Badawi Fleet Platform - Ingestion Checksum & Diff Generator
 * Ref: ADR-004 (Spark Free Plan Quota Protection), ADR-049
 * 
 * Provides deterministic hashing to detect real operational changes
 * and skip unnecessary Firestore writes, saving up to 95% of Spark write quotas.
 */

import type { VehicleDailyAnalysisResult } from '../analysis/types.js';
import type { DailySummaryDocument } from '../schema/types.js';

/**
 * Fast 32-bit FNV-1a deterministic hash implementation (zero dependencies).
 */
export function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit FNV prime: 16777619
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Produces a normalized, canonical signature string of a daily summary
 * to prevent false diffs caused by non-essential timestamp micro-jitter.
 */
export function canonicalSummarySignature(
  result: VehicleDailyAnalysisResult | DailySummaryDocument
): string {
  if ('summaryId' in result) {
    // It's a DailySummaryDocument
    const tripsRepr = result.trips
      .map((t) => `${t.start}|${t.end}|${t.origin}|${t.destination}|${t.durationMinutes}`)
      .join(';');
    const stopsRepr = result.stops
      .map((s) => `${s.location}|${s.start}|${s.end}|${s.durationMinutes}`)
      .join(';');

    return [
      result.date,
      result.vehicleId,
      result.vehicleType,
      result.tripsCount,
      tripsRepr,
      result.stopsCount,
      stopsRepr,
      result.firstMovement || '',
      result.lastMovement || '',
      result.matchingStatus || 'pending',
      result.rulesVersion || ''
    ].join('::');
  }

  // It's a VehicleDailyAnalysisResult from analysis pipeline
  const haulsRepr = result.hauls
    .map((h) => `${h.haulNumber}|${h.startTime}|${h.endTime}|${h.durationMinutes}|${h.status}`)
    .join(';');
  const tripsRepr = result.trips
    .map((t) => `${t.startTime}|${t.endTime}|${t.startLocation.name || ''}|${t.endLocation.name || ''}|${t.durationMinutes}`)
    .join(';');
  const stopsRepr = result.stops
    .map((s) => `${s.geofenceId || ''}|${s.startTime}|${s.endTime}|${s.durationMinutes}`)
    .join(';');

  const tripsCount = result.hauls.length > 0 ? result.hauls.length : result.trips.length;

  return [
    result.operationalDate,
    result.vehicleId,
    result.vehicleType,
    tripsCount,
    haulsRepr || tripsRepr,
    result.stops.length,
    stopsRepr,
    result.totalDistanceKm,
    result.totalMovingMinutes,
    result.totalStopMinutes,
    result.gpsStatus.status,
    result.metadata.rulesVersion
  ].join('::');
}

/**
 * Computes a deterministic checksum for a daily summary.
 */
export function computeSummaryChecksum(
  result: VehicleDailyAnalysisResult | DailySummaryDocument
): string {
  const sig = canonicalSummarySignature(result);
  return fnv1aHex(sig);
}

/**
 * Determines whether a newly calculated summary differs from the previous one.
 */
export function hasSummaryChanged(
  previousChecksum: string | undefined,
  newChecksum: string,
  forceAllWrites = false
): boolean {
  if (forceAllWrites) return true;
  if (!previousChecksum) return true;
  return previousChecksum !== newChecksum;
}
