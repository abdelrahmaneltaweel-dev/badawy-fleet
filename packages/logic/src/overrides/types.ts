/**
 * Badawi Fleet Platform — Overrides & Fingerprint Types (T4.4)
 * 
 * المرجع: docs/adr/ADR-018, ADR-031, ADR-048, ADR-055, ADR-060
 * طبقة التعديلات اليدوية للمسؤولين بالبصمة الزمنية المستقرة للمركبة
 * تصمد 100% أمام تحسين الخوارزميات وإعادة التحليل اليومي.
 */

import type { HaulCycle, VehicleTrip, VehicleDailyAnalysisResult, GeofenceType } from '../analysis/types.js';

export type OverrideKind = 
  | 'update'   // تعديل حقول (كيلومترات، وجهة، حالة)
  | 'delete'   // حذف / شاهد قبر (Tombstone) لنقلة أو مشوار وهمي
  | 'insert'   // إضافة يدوية لنقلة أو مشوار لم يرصده الـ GPS
  | 'note';    // إضافة ملاحظة إدارية دون تغيير الأرقام

export type OverrideTarget = 'haul' | 'trip' | 'stop' | 'day';

export interface FingerprintData {
  hash: string;
  startSec: number;
  endSec: number;
  str: string;
}

export interface HaulOverridePayload {
  haulNumber?: number;
  travelDistanceKm?: number;
  loadingLocationName?: string;
  unloadingLocationName?: string;
  unloadingGeofenceType?: GeofenceType;
  status?: 'completed' | 'in_progress' | 'cancelled';
  note?: string;
  customPrice?: number;
}

export interface TripOverridePayload {
  tripNumber?: number;
  distanceKm?: number;
  startLocationName?: string;
  endLocationName?: string;
  note?: string;
}

export interface EntityOverride {
  id: string; // e.g. "OVR-116-2026-10-18-H1"
  vehicleId: string;
  operationalDate: string; // YYYY-MM-DD
  target: OverrideTarget;
  kind: OverrideKind;
  fingerprint: string; // البصمة الزمنية المستقرة "hash|startSec|endSec"
  timeWindow?: {
    start: string; // ISO
    end: string;   // ISO
  };
  payload: HaulOverridePayload | TripOverridePayload | Record<string, unknown>;
  reason: string; // سبب التعديل (إلزامي للتدقيق ADR-018)
  appliedBy: string; // معرف المستخدم المسؤول (أو البريد)
  appliedByName?: string;
  appliedAt: string; // توقيت التعديل (ISO)
  active: boolean; // تفعيل أو تعطيل التعديل
}

export interface OverrideAuditEntry {
  overrideId: string;
  target: OverrideTarget;
  kind: OverrideKind;
  appliedBy: string;
  reason: string;
  appliedAt: string;
  description: string;
}

export interface OverlaidHaulCycle extends HaulCycle {
  isOverridden?: boolean;
  overrideId?: string;
  overrideReason?: string;
  originalValues?: Partial<HaulCycle>;
}

export interface OverlaidVehicleTrip extends VehicleTrip {
  isOverridden?: boolean;
  overrideId?: string;
  overrideReason?: string;
  originalValues?: Partial<VehicleTrip>;
}

export interface OverlaidDailyResult extends Omit<VehicleDailyAnalysisResult, 'hauls' | 'trips'> {
  hauls: OverlaidHaulCycle[];
  trips: OverlaidVehicleTrip[];
  originalHaulsCount: number;
  originalTripsCount: number;
  overridesAppliedCount: number;
  isOverridden: boolean;
  appliedOverrides: EntityOverride[];
  overridesAudit: OverrideAuditEntry[];
}
