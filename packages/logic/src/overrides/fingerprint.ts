/**
 * Badawi Fleet Platform — Deterministic Fingerprint Generator (البصمة الزمنية)
 * 
 * المرجع: docs/adr/ADR-048, ADR-055, Section 7.5, Manual edits.gs (editsSigFrom_)
 * خوارزمية توليد ومطابقة بصمات النقلات والمشاوير المستقرة لحماية التعديلات اليدوية.
 */

import type { HaulCycle, VehicleTrip } from '../analysis/types.js';
import type { FingerprintData } from './types.js';

/**
 * دالة تجزئة سريعة ونقية 100% بلا أي مكتبات خارجية (FNV-1a 32-bit Hash)
 */
export function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * توليد بصمة فريدة ومستقرة لنقلة جرار
 * الصيغة: hash|startEpochSec|endEpochSec
 */
export function computeHaulFingerprint(haul: HaulCycle): string {
  const startSec = Math.floor(new Date(haul.startTime).getTime() / 1000);
  const endSec = Math.floor(new Date(haul.endTime).getTime() / 1000);

  const loadType = haul.loadingStop?.geofenceType || 'crusher';
  const unloadType = haul.unloadingStop?.geofenceType || 'dump_site';

  // تجميع الأوقات في فترات 5 دقائق لضمان ثبات البصمة أمام تذبذب النقاط الأولى
  const startBucket = Math.floor(startSec / 300);
  const endBucket = Math.floor(endSec / 300);

  const content = `${haul.vehicleId}:${loadType}:${unloadType}:${startBucket}:${endBucket}`;
  const hash = hashString(content);

  return `${hash}|${startSec}|${endSec}`;
}

/**
 * توليد بصمة فريدة ومستقرة لمشوار عربية نقل أو ملاكي
 */
export function computeTripFingerprint(trip: VehicleTrip, vehicleId?: string): string {
  const vId = trip.vehicleId || vehicleId || 'UNKNOWN';
  const startSec = Math.floor(new Date(trip.startTime).getTime() / 1000);
  const endSec = Math.floor(new Date(trip.endTime).getTime() / 1000);

  const startLat = Math.round((trip.startLocation?.lat || 0) * 100) / 100;
  const startLng = Math.round((trip.startLocation?.lng || 0) * 100) / 100;
  const endLat = Math.round((trip.endLocation?.lat || 0) * 100) / 100;
  const endLng = Math.round((trip.endLocation?.lng || 0) * 100) / 100;

  const startBucket = Math.floor(startSec / 300);
  const endBucket = Math.floor(endSec / 300);

  const content = `${vId}:${startLat},${startLng}:${endLat},${endLng}:${startBucket}:${endBucket}`;
  const hash = hashString(content);

  return `${hash}|${startSec}|${endSec}`;
}

/**
 * تفكيك نص البصمة إلى مكوناته
 */
export function parseFingerprint(sig: string): FingerprintData | null {
  if (!sig || typeof sig !== 'string') return null;
  const parts = sig.trim().split('|');
  if (parts.length < 3) return null;

  const hash = parts[0];
  const startSec = parseInt(parts[1], 10);
  const endSec = parseInt(parts[2], 10);

  if (isNaN(startSec) || isNaN(endSec)) return null;

  return {
    hash,
    startSec,
    endSec,
    str: sig
  };
}

/**
 * مطابقة ذكية بين بصمتين مع مراعاة سماحية تحسين الكود (Tolerance Window)
 * إذا تغيرت خوارزمية تنظيف الإشارة وزحزحت وقت البداية/النهاية دقيقة أو دقيقتين،
 * تستمر المطابقة بنجاح لحماية التعديل البشري.
 */
export function isFingerprintMatch(
  sig1: string,
  sig2: string,
  toleranceSec: number = 600 // سماحية 10 دقائق افتراضياً
): boolean {
  if (!sig1 || !sig2) return false;
  if (sig1 === sig2) return true;

  const p1 = parseFingerprint(sig1);
  const p2 = parseFingerprint(sig2);

  if (!p1 || !p2) return false;

  // 1. تطابق الهاش المباشر مع التحقق من التقارب الزمني (في غضون ساعة أو حد السماحية)
  if (p1.hash === p2.hash && Math.abs(p1.startSec - p2.startSec) <= Math.max(3600, toleranceSec)) {
    return true;
  }

  // 2. فحص تقاطع الفترات الزمنية (Temporal Overlap)
  const overlapStart = Math.max(p1.startSec, p2.startSec);
  const overlapEnd = Math.min(p1.endSec, p2.endSec);
  const overlapDuration = overlapEnd - overlapStart;

  // إذا كانت بداية ونهاية الفترتين متقاربة ضمن حد السماحية
  const startDiff = Math.abs(p1.startSec - p2.startSec);
  const endDiff = Math.abs(p1.endSec - p2.endSec);

  if (startDiff <= toleranceSec && endDiff <= toleranceSec) {
    return true;
  }

  // أو إذا كان التقاطع الزمني يغطي أكثر من 60% من أقصر الدورتين
  const dur1 = p1.endSec - p1.startSec;
  const dur2 = p2.endSec - p2.startSec;
  const minDur = Math.min(dur1, dur2);

  if (minDur > 0 && overlapDuration > 0) {
    const ratio = overlapDuration / minDur;
    if (ratio >= 0.6) {
      return true;
    }
  }

  return false;
}
