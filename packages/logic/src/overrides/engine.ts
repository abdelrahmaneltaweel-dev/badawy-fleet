/**
 * Badawi Fleet Platform — Overrides Application Engine (T4.4)
 * 
 * المرجع: docs/adr/ADR-018, ADR-031, ADR-048, ADR-055, Section 7.5, Manual edits.gs
 * محرك تطبيق التعديلات اليدوية المحفوظة بالبصمة على نتائج التحليل اليومي للـ GPS.
 */

import type {
  HaulCycle,
  VehicleTrip,
  VehicleDailyAnalysisResult,
  GpsStop
} from '../analysis/types.js';
import type {
  EntityOverride,
  OverrideKind,
  OverrideTarget,
  HaulOverridePayload,
  TripOverridePayload,
  OverlaidHaulCycle,
  OverlaidVehicleTrip,
  OverlaidDailyResult,
  OverrideAuditEntry
} from './types.js';
import {
  computeHaulFingerprint,
  computeTripFingerprint,
  isFingerprintMatch
} from './fingerprint.js';

/**
 * إنشاء كائن تعديل معتمد وموثق وفق معايير الأمان والتدقيق (ADR-018)
 */
export function createEntityOverride(params: {
  id?: string;
  vehicleId: string;
  operationalDate: string;
  target: OverrideTarget;
  kind: OverrideKind;
  fingerprint: string;
  timeWindow?: { start: string; end: string };
  payload: HaulOverridePayload | TripOverridePayload | Record<string, unknown>;
  reason: string;
  appliedBy: string;
  appliedByName?: string;
  appliedAt?: string;
  active?: boolean;
}): EntityOverride {
  if (!params.reason || !params.reason.trim()) {
    throw new Error('سبب التعديل إلزامي لحفظ التعديلات اليدوية وسجل التدقيق (ADR-018)');
  }
  if (!params.appliedBy || !params.appliedBy.trim()) {
    throw new Error('معرف المستخدم الذي أجرى التعديل إلزامي (ADR-018)');
  }

  const id = params.id || `OVR-${params.vehicleId}-${params.operationalDate}-${Date.now()}`;
  return {
    id,
    vehicleId: params.vehicleId,
    operationalDate: params.operationalDate,
    target: params.target,
    kind: params.kind,
    fingerprint: params.fingerprint,
    timeWindow: params.timeWindow,
    payload: params.payload,
    reason: params.reason.trim(),
    appliedBy: params.appliedBy.trim(),
    appliedByName: params.appliedByName,
    appliedAt: params.appliedAt || new Date().toISOString(),
    active: params.active ?? true
  };
}

/**
 * إنشاء تعديل حذف / شاهد قبر (Tombstone) لنقلة أو دورة غير صحيحة
 */
export function createTombstoneOverride(
  item: HaulCycle | VehicleTrip,
  target: OverrideTarget,
  reason: string,
  appliedBy: string
): EntityOverride {
  const isHaul = 'loadingStop' in item;
  const fingerprint = isHaul
    ? computeHaulFingerprint(item as HaulCycle)
    : computeTripFingerprint(item as VehicleTrip);

  const operationalDate = item.startTime.substring(0, 10);
  const vehicleId = item.vehicleId || 'UNKNOWN';

  return createEntityOverride({
    vehicleId,
    operationalDate,
    target,
    kind: 'delete',
    fingerprint,
    timeWindow: {
      start: item.startTime,
      end: item.endTime
    },
    payload: {},
    reason,
    appliedBy
  });
}

/**
 * تطبيق التعديلات اليدوية على قائمة النقلات المحسوبة
 */
export function applyOverridesToHauls(
  rawHauls: HaulCycle[],
  overrides: EntityOverride[],
  vehicleId: string = 'UNKNOWN'
): {
  hauls: OverlaidHaulCycle[];
  applied: EntityOverride[];
  audit: OverrideAuditEntry[];
} {
  const activeOverrides = overrides.filter(
    (o) => o.active && o.target === 'haul' && (o.vehicleId === vehicleId || o.vehicleId === 'ALL')
  );

  if (activeOverrides.length === 0) {
    return {
      hauls: rawHauls.map((h) => ({ ...h })),
      applied: [],
      audit: []
    };
  }

  const applied: EntityOverride[] = [];
  const audit: OverrideAuditEntry[] = [];
  const overlaid: OverlaidHaulCycle[] = [];

  const tombstones = activeOverrides.filter((o) => o.kind === 'delete');
  const updates = activeOverrides.filter((o) => o.kind === 'update');
  const inserts = activeOverrides.filter((o) => o.kind === 'insert');
  const notes = activeOverrides.filter((o) => o.kind === 'note');

  // 1. معالجة النقلات المستخرجة من الـ GPS
  for (const rawHaul of rawHauls) {
    const rawSig = computeHaulFingerprint(rawHaul);

    // فحص شواهد القبور (Tombstones / Deletions)
    const matchingTombstone = tombstones.find((t) =>
      isFingerprintMatch(rawSig, t.fingerprint)
    );

    if (matchingTombstone) {
      applied.push(matchingTombstone);
      audit.push({
        overrideId: matchingTombstone.id,
        target: 'haul',
        kind: 'delete',
        appliedBy: matchingTombstone.appliedBy,
        reason: matchingTombstone.reason,
        appliedAt: matchingTombstone.appliedAt,
        description: `تم استبعاد النقلة رقم [${rawHaul.haulNumber}] بناءً على تعديل يدوي: ${matchingTombstone.reason}`
      });
      // استبعاد النقلة تماماً من الإخراج
      continue;
    }

    // فحص تعديلات الحقول (Updates)
    const matchingUpdate = updates.find((u) =>
      isFingerprintMatch(rawSig, u.fingerprint)
    );

    const matchingNote = notes.find((n) =>
      isFingerprintMatch(rawSig, n.fingerprint)
    );

    if (matchingUpdate) {
      const payload = matchingUpdate.payload as HaulOverridePayload;
      const originalValues: Partial<HaulCycle> = {
        travelDistanceKm: rawHaul.travelDistanceKm,
        status: rawHaul.status
      };

      const modifiedHaul: OverlaidHaulCycle = {
        ...rawHaul,
        travelDistanceKm: payload.travelDistanceKm !== undefined ? payload.travelDistanceKm : rawHaul.travelDistanceKm,
        status: payload.status !== undefined ? payload.status : rawHaul.status,
        isOverridden: true,
        overrideId: matchingUpdate.id,
        overrideReason: matchingUpdate.reason,
        originalValues
      };

      // تعديل اسم موقع التفريغ أو نوعه إذا حُدّد يدوياً
      if (payload.unloadingLocationName && modifiedHaul.unloadingStop) {
        modifiedHaul.unloadingStop = {
          ...modifiedHaul.unloadingStop,
          geofenceName: payload.unloadingLocationName,
          geofenceType: payload.unloadingGeofenceType || modifiedHaul.unloadingStop.geofenceType
        };
      }

      applied.push(matchingUpdate);
      audit.push({
        overrideId: matchingUpdate.id,
        target: 'haul',
        kind: 'update',
        appliedBy: matchingUpdate.appliedBy,
        reason: matchingUpdate.reason,
        appliedAt: matchingUpdate.appliedAt,
        description: `تم تعديل بيانات النقلة رقم [${rawHaul.haulNumber}] (${matchingUpdate.reason})`
      });

      overlaid.push(modifiedHaul);
    } else {
      const item: OverlaidHaulCycle = { ...rawHaul };
      if (matchingNote) {
        applied.push(matchingNote);
        item.isOverridden = true;
        item.overrideReason = matchingNote.reason;
      }
      overlaid.push(item);
    }
  }

  // 2. معالجة الإضافات اليدوية (Inserts)
  for (const ins of inserts) {
    const payload = ins.payload as HaulOverridePayload;
    const startIso = ins.timeWindow?.start || new Date().toISOString();
    const endIso = ins.timeWindow?.end || new Date().toISOString();
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    const dummyLoadingStop: GpsStop = {
      id: `STOP-MANUAL-LOAD-${ins.id}`,
      vehicleId,
      startTime: startIso,
      endTime: startIso,
      durationMinutes: 10,
      centerLat: 31.0200,
      centerLng: 29.7200,
      geofenceName: payload.loadingLocationName || 'كسارة (إدخال يدوي)',
      geofenceType: 'crusher',
      isMaintenance: false,
      isSiteVisit: true,
      maxSpeedDuringStop: 0,
      pointCount: 1
    };

    const dummyUnloadingStop: GpsStop = {
      id: `STOP-MANUAL-UNLOAD-${ins.id}`,
      vehicleId,
      startTime: endIso,
      endTime: endIso,
      durationMinutes: 10,
      centerLat: 31.1500,
      centerLng: 29.8500,
      geofenceName: payload.unloadingLocationName || 'موقع تفريغ (إدخال يدوي)',
      geofenceType: payload.unloadingGeofenceType || 'dump_site',
      isMaintenance: false,
      isSiteVisit: true,
      maxSpeedDuringStop: 0,
      pointCount: 1
    };

    const manualHaul: OverlaidHaulCycle = {
      id: `HAUL-MANUAL-${ins.id}`,
      vehicleId,
      haulNumber: overlaid.length + 1,
      startTime: startIso,
      endTime: endIso,
      durationMinutes,
      loadingStop: dummyLoadingStop,
      unloadingStop: dummyUnloadingStop,
      travelDistanceKm: payload.travelDistanceKm || 25,
      status: payload.status || 'completed',
      isOverridden: true,
      overrideId: ins.id,
      overrideReason: ins.reason
    };

    applied.push(ins);
    audit.push({
      overrideId: ins.id,
      target: 'haul',
      kind: 'insert',
      appliedBy: ins.appliedBy,
      reason: ins.reason,
      appliedAt: ins.appliedAt,
      description: `تمت إضافة نقلة يدوية جديدة: ${ins.reason}`
    });

    overlaid.push(manualHaul);
  }

  // 3. الترتيب الزمني الصاعد وإعادة ترقيم النقلات المتتابعة
  overlaid.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  overlaid.forEach((h, index) => {
    h.haulNumber = index + 1;
  });

  return {
    hauls: overlaid,
    applied,
    audit
  };
}

/**
 * تطبيق التعديلات اليدوية على قائمة المشاوير المحسوبة
 */
export function applyOverridesToTrips(
  rawTrips: VehicleTrip[],
  overrides: EntityOverride[],
  vehicleId: string = 'UNKNOWN'
): {
  trips: OverlaidVehicleTrip[];
  applied: EntityOverride[];
  audit: OverrideAuditEntry[];
} {
  const activeOverrides = overrides.filter(
    (o) => o.active && o.target === 'trip' && (o.vehicleId === vehicleId || o.vehicleId === 'ALL')
  );

  if (activeOverrides.length === 0) {
    return {
      trips: rawTrips.map((t) => ({ ...t })),
      applied: [],
      audit: []
    };
  }

  const applied: EntityOverride[] = [];
  const audit: OverrideAuditEntry[] = [];
  const overlaid: OverlaidVehicleTrip[] = [];

  const tombstones = activeOverrides.filter((o) => o.kind === 'delete');
  const updates = activeOverrides.filter((o) => o.kind === 'update');
  const inserts = activeOverrides.filter((o) => o.kind === 'insert');

  // 1. معالجة المشاوير
  for (const rawTrip of rawTrips) {
    const rawSig = computeTripFingerprint(rawTrip, vehicleId);

    const matchingTombstone = tombstones.find((t) =>
      isFingerprintMatch(rawSig, t.fingerprint)
    );

    if (matchingTombstone) {
      applied.push(matchingTombstone);
      audit.push({
        overrideId: matchingTombstone.id,
        target: 'trip',
        kind: 'delete',
        appliedBy: matchingTombstone.appliedBy,
        reason: matchingTombstone.reason,
        appliedAt: matchingTombstone.appliedAt,
        description: `تم حذف المشوار رقم [${rawTrip.tripNumber}] بناءً على تعديل يدوي: ${matchingTombstone.reason}`
      });
      continue;
    }

    const matchingUpdate = updates.find((u) =>
      isFingerprintMatch(rawSig, u.fingerprint)
    );

    if (matchingUpdate) {
      const payload = matchingUpdate.payload as TripOverridePayload;
      const modifiedTrip: OverlaidVehicleTrip = {
        ...rawTrip,
        distanceKm: payload.distanceKm !== undefined ? payload.distanceKm : rawTrip.distanceKm,
        isOverridden: true,
        overrideId: matchingUpdate.id,
        overrideReason: matchingUpdate.reason,
        originalValues: { distanceKm: rawTrip.distanceKm }
      };

      if (payload.startLocationName) {
        modifiedTrip.startLocation = {
          ...modifiedTrip.startLocation,
          name: payload.startLocationName
        };
      }
      if (payload.endLocationName) {
        modifiedTrip.endLocation = {
          ...modifiedTrip.endLocation,
          name: payload.endLocationName
        };
      }

      applied.push(matchingUpdate);
      audit.push({
        overrideId: matchingUpdate.id,
        target: 'trip',
        kind: 'update',
        appliedBy: matchingUpdate.appliedBy,
        reason: matchingUpdate.reason,
        appliedAt: matchingUpdate.appliedAt,
        description: `تم تعديل مسافة المشوار رقم [${rawTrip.tripNumber}] إلى ${modifiedTrip.distanceKm} كم`
      });

      overlaid.push(modifiedTrip);
    } else {
      overlaid.push({ ...rawTrip });
    }
  }

  // 2. معالجة الإضافات اليدوية
  for (const ins of inserts) {
    const payload = ins.payload as TripOverridePayload;
    const startIso = ins.timeWindow?.start || new Date().toISOString();
    const endIso = ins.timeWindow?.end || new Date().toISOString();
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    const manualTrip: OverlaidVehicleTrip = {
      id: `TRIP-MANUAL-${ins.id}`,
      vehicleId,
      tripNumber: overlaid.length + 1,
      startTime: startIso,
      endTime: endIso,
      durationMinutes,
      startLocation: { lat: 31.2, lng: 29.9, name: payload.startLocationName || 'نقطة الانطلاق' },
      endLocation: { lat: 31.25, lng: 29.95, name: payload.endLocationName || 'نقطة الوصول' },
      distanceKm: payload.distanceKm || 15,
      movingMinutes: durationMinutes,
      stopMinutes: 0,
      maxSpeedKmH: 60,
      avgSpeedKmH: 45,
      intermediateStops: [],
      isOverridden: true,
      overrideId: ins.id,
      overrideReason: ins.reason
    };

    applied.push(ins);
    audit.push({
      overrideId: ins.id,
      target: 'trip',
      kind: 'insert',
      appliedBy: ins.appliedBy,
      reason: ins.reason,
      appliedAt: ins.appliedAt,
      description: `تمت إضافة مشوار يدوي: ${ins.reason}`
    });

    overlaid.push(manualTrip);
  }

  overlaid.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  overlaid.forEach((t, index) => {
    t.tripNumber = index + 1;
  });

  return {
    trips: overlaid,
    applied,
    audit
  };
}

/**
 * دمج وتطبيق كامل التعديلات اليدوية بالبصمة على نتيجة التحليل اليومي الشامل للمركبة
 * وإعادة احتساب الكيلومترات والإجماليات مع الحفاظ التام على البصمة
 */
export function applyOverridesToDailyAnalysis(
  dailyResult: VehicleDailyAnalysisResult,
  overrides: EntityOverride[]
): OverlaidDailyResult {
  const isTractor =
    dailyResult.vehicleType === 'tractor' ||
    dailyResult.vehicleType === 'جرار' ||
    dailyResult.vehicleType === 'dump_truck';

  const haulRes = isTractor
    ? applyOverridesToHauls(dailyResult.hauls, overrides, dailyResult.vehicleId)
    : { hauls: [], applied: [], audit: [] };

  const tripRes = !isTractor
    ? applyOverridesToTrips(dailyResult.trips, overrides, dailyResult.vehicleId)
    : { trips: [], applied: [], audit: [] };

  const appliedAll = [...haulRes.applied, ...tripRes.applied];
  const auditAll = [...haulRes.audit, ...tripRes.audit];

  // إعادة احتساب إجمالي الكيلومترات اليومية بعد التعديل
  let totalDistanceKm = dailyResult.totalDistanceKm;

  if (isTractor && haulRes.applied.length > 0) {
    totalDistanceKm = haulRes.hauls.reduce((sum, h) => sum + h.travelDistanceKm, 0);
  } else if (!isTractor && tripRes.applied.length > 0) {
    totalDistanceKm = tripRes.trips.reduce((sum, t) => sum + t.distanceKm, 0);
  }

  return {
    ...dailyResult,
    hauls: haulRes.hauls,
    trips: tripRes.trips,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    originalHaulsCount: dailyResult.hauls.length,
    originalTripsCount: dailyResult.trips.length,
    overridesAppliedCount: appliedAll.length,
    isOverridden: appliedAll.length > 0,
    appliedOverrides: appliedAll,
    overridesAudit: auditAll
  };
}
