/**
 * Badawi Fleet Platform — Vehicle Live GPS Status & Automated Issue Detection
 * 
 * المرجع: docs/adr/ADR-019 (المشاكل = مشاكل GPS فقط)، ADR-059
 * تقييم الحالة اللحظية (سير، انتظار، ركنة، انقطاع، تجمد إشارة)
 * وتوليد بيانات المشاكل التلقائية للمتابعة الفورية.
 */

import type { RawGpsPoint, VehicleGpsStatus, GpsLiveStatus, AnalysisConfig } from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';

export function evaluateVehicleGpsStatus(
  vehicleId: string,
  rawPoints: RawGpsPoint[],
  referenceTime: Date | string = new Date(),
  customConfig?: Partial<AnalysisConfig>
): VehicleGpsStatus {
  const config = { ...DEFAULT_ANALYSIS_CONFIG, ...customConfig };
  const refDate = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
  const refTimeMs = isNaN(refDate.getTime()) ? Date.now() : refDate.getTime();

  if (!rawPoints || rawPoints.length === 0) {
    return {
      vehicleId,
      status: 'no_data',
      statusLabelAr: 'لا توجد بيانات',
      currentSpeedKmH: 0,
      isIgnitionOn: false,
      offlineMinutes: 9999,
      hasActiveIssue: false
    };
  }

  // فرز النقاط تصاعدياً بالوقت
  const sorted = [...rawPoints]
    .map(p => ({
      ...p,
      time: p.timestamp instanceof Date ? p.timestamp : new Date(p.timestamp)
    }))
    .filter(p => !isNaN(p.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (sorted.length === 0) {
    return {
      vehicleId,
      status: 'no_data',
      statusLabelAr: 'لا توجد بيانات',
      currentSpeedKmH: 0,
      isIgnitionOn: false,
      offlineMinutes: 9999,
      hasActiveIssue: false
    };
  }

  const latest = sorted[sorted.length - 1];
  const lastTimeMs = latest.time.getTime();
  const diffMs = Math.max(0, refTimeMs - lastTimeMs);
  const offlineMinutes = Math.floor(diffMs / 60000);

  const speed = typeof latest.speed === 'number' && !isNaN(latest.speed) ? Math.max(0, latest.speed) : 0;
  const ignition = typeof latest.ignition === 'boolean' ? latest.ignition : (speed > config.stopSpeedThreshold);

  // 1. فحص الانقطاع (Offline)
  if (offlineMinutes >= config.offlineThresholdMinutes) {
    return {
      vehicleId,
      lastPingTime: latest.time.toISOString(),
      status: 'offline',
      statusLabelAr: `منقطعة منذ ${offlineMinutes} دقيقة`,
      lastLocation: { lat: latest.latitude, lng: latest.longitude },
      currentSpeedKmH: speed,
      isIgnitionOn: ignition,
      offlineMinutes,
      hasActiveIssue: true,
      issueType: 'offline',
      issueDetails: `انقطاع إشارة جهاز الـ GPS منذ أكثر من ${offlineMinutes} دقيقة (آخر ظهور: ${latest.time.toISOString()})`
    };
  }

  // 2. فحص تجمد الإشارة (Frozen Signal):
  // إذا كانت آخر مجموعة نقاط خلال مدة التجمد (30 دقيقة) لها نفس الإحداثيات تماماً مع تشغيل الموتور أو سرعة معلنة
  const frozenWindowMs = config.frozenSignalThresholdMinutes * 60000;
  const recentPoints = sorted.filter(p => (lastTimeMs - p.time.getTime()) <= frozenWindowMs);

  let isFrozen = false;
  if (recentPoints.length >= 5) {
    const firstRecent = recentPoints[0];
    const allSameCoords = recentPoints.every(
      p => Math.abs(p.latitude - firstRecent.latitude) < 0.00001 &&
           Math.abs(p.longitude - firstRecent.longitude) < 0.00001
    );

    const hasMovementClaimed = recentPoints.some(p => p.speed > 5);
    if (allSameCoords && (hasMovementClaimed || ignition)) {
      // إحداثيات ثابتة بالملي رغم تشغيل أو ادعاء سرعة لمدة تفوق العتبة
      isFrozen = true;
    }
  }

  if (isFrozen) {
    return {
      vehicleId,
      lastPingTime: latest.time.toISOString(),
      status: 'frozen_signal',
      statusLabelAr: 'إشارة متجمدة',
      lastLocation: { lat: latest.latitude, lng: latest.longitude },
      currentSpeedKmH: speed,
      isIgnitionOn: ignition,
      offlineMinutes,
      hasActiveIssue: true,
      issueType: 'frozen_signal',
      issueDetails: `إشارة الـ GPS متجمدة بنفس الإحداثيات منذ ${config.frozenSignalThresholdMinutes} دقيقة مع عمل المحرك`
    };
  }

  // 3. الحالة الطبيعية (سير / انتظار / ركنة)
  let status: GpsLiveStatus = 'parked';
  let statusLabelAr = 'متوقفة';

  if (speed > config.stopSpeedThreshold && ignition) {
    status = 'moving';
    statusLabelAr = 'في حركة';
  } else if (ignition) {
    status = 'idle';
    statusLabelAr = 'انتظار (محرك يعمل)';
  } else {
    status = 'parked';
    statusLabelAr = 'متوقفة';
  }

  return {
    vehicleId,
    lastPingTime: latest.time.toISOString(),
    status,
    statusLabelAr,
    lastLocation: { lat: latest.latitude, lng: latest.longitude },
    currentSpeedKmH: Math.round(speed * 10) / 10,
    isIgnitionOn: ignition,
    offlineMinutes,
    hasActiveIssue: false
  };
}
