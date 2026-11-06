/**
 * Badawi Fleet Platform — Daily Vehicle Analysis Pipeline
 * 
 * المرجع: docs/adr/ADR-005, ADR-016, ADR-023, ADR-048, ADR-055, ADR-059, ADR-060
 * معالج موحد يجمع دورة التحليل اليومية المتكاملة لكل عربية بحسب نوعها
 * ويعمل بكفاءة فائقة وسرعة ميلي-ثانية في Node.js والمتصفح.
 */

import type {
  RawGpsPoint,
  Geofence,
  AnalysisConfig,
  VehicleDailyAnalysisResult
} from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';
import { cleanAndFilterGpsPoints } from './cleaner.js';
import { detectStops } from './stops.js';
import { detectHaulCycles } from './hauls.js';
import { detectVehicleTrips } from './trips.js';
import { evaluateVehicleGpsStatus } from './status.js';

export interface VehicleAnalysisInput {
  id: string;
  type: 'tractor' | 'transport' | 'passenger' | 'جرار' | 'نقل' | 'ملاكي' | string;
  name?: string;
}

/**
 * استخراج تاريخ يوم التشغيل المعتمد (يبدأ الساعة 06:00 صباحاً)
 * أي توقيت قبل 6 صباحاً يتبع اليوم السابق تشغيلياً
 */
export function getOperationalDateString(date: Date, startHour: number = 6): string {
  const d = new Date(date);
  if (d.getHours() < startHour) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function analyzeVehicleDailyData(
  vehicle: VehicleAnalysisInput,
  rawPoints: RawGpsPoint[],
  geofences: Geofence[] = [],
  operationalDate?: string,
  referenceNow: Date | string = new Date(),
  customConfig?: Partial<AnalysisConfig>
): VehicleDailyAnalysisResult {
  const config = { ...DEFAULT_ANALYSIS_CONFIG, ...customConfig };

  const resolvedDate = operationalDate || (
    rawPoints.length > 0
      ? getOperationalDateString(new Date(rawPoints[0].timestamp), config.operationalDayStartHour)
      : getOperationalDateString(new Date(), config.operationalDayStartHour)
  );

  // 1. تنظيف الإشارة
  const cleanPoints = cleanAndFilterGpsPoints(rawPoints, config);

  // 2. رصد وتجميع الوقفات
  const stops = detectStops(cleanPoints, geofences, vehicle.id, config);
  const maintenanceCount = stops.filter(s => s.isMaintenance).length;

  // 3. تحليل النقلات والمشاوير حسب نوع العربية
  const isTractor = 
    vehicle.type === 'tractor' || 
    vehicle.type === 'جرار' || 
    vehicle.type === 'dump_truck';

  const hauls = isTractor 
    ? detectHaulCycles(cleanPoints, stops, vehicle.id, config) 
    : [];

  const trips = !isTractor 
    ? detectVehicleTrips(cleanPoints, stops, geofences, vehicle.id, config) 
    : [];

  // 4. تقييم حالة الـ GPS اللحظية
  const gpsStatus = evaluateVehicleGpsStatus(vehicle.id, rawPoints, referenceNow, config);

  // 5. احتساب الإجماليات
  let totalDistanceKm = 0;
  let totalMovingMinutes = 0;
  let totalStopMinutes = 0;
  let maxSpeedKmH = 0;
  let movingSpeedSum = 0;
  let movingPointsCount = 0;

  for (const pt of cleanPoints) {
    totalDistanceKm += pt.distanceKmFromPrev;
    if (pt.speed > config.stopSpeedThreshold) {
      totalMovingMinutes += (pt.timeDiffSeconds / 60);
      if (pt.speed > maxSpeedKmH) maxSpeedKmH = pt.speed;
      movingSpeedSum += pt.speed;
      movingPointsCount++;
    } else {
      totalStopMinutes += (pt.timeDiffSeconds / 60);
    }
  }

  const avgMovingSpeedKmH = movingPointsCount > 0 
    ? Math.round((movingSpeedSum / movingPointsCount) * 10) / 10 
    : 0;

  return {
    vehicleId: vehicle.id,
    vehicleType: vehicle.type,
    operationalDate: resolvedDate,
    rawPointsCount: rawPoints.length,
    cleanPointsCount: cleanPoints.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalMovingMinutes: Math.round(totalMovingMinutes * 10) / 10,
    totalStopMinutes: Math.round(totalStopMinutes * 10) / 10,
    maxSpeedKmH: Math.round(maxSpeedKmH * 10) / 10,
    avgMovingSpeedKmH,
    stops,
    maintenanceCount,
    hauls,
    trips,
    gpsStatus,
    metadata: {
      processedAt: new Date().toISOString(),
      rulesVersion: config.rulesVersion
    }
  };
}
