/**
 * Badawi Fleet Platform — Haul Cycles Detection (النقلات ودورات العمل)
 * 
 * رصد دورات العمل لسيارات النقل الثقيل والجرارات:
 * وقفة تحميل (كسارة / محجر) -> مسار سير -> وقفة تفريغ (خلاطة / مشروع / تفريغ)
 */

import type { CleanGpsPoint, GpsStop, HaulCycle, AnalysisConfig } from './types.js';
import { calculateDistanceKm } from './geo.js';

export function detectHaulCycles(
  cleanedPoints: CleanGpsPoint[],
  stops: GpsStop[],
  vehicleId: string = 'UNKNOWN',
  _customConfig?: Partial<AnalysisConfig>
): HaulCycle[] {
  if (!stops || stops.length < 2) {
    return [];
  }

  const hauls: HaulCycle[] = [];

  // تصنيف الوقفات بحسب نوع الموقع الجغرافي
  // مواقع التحميل النموذجية: crusher (كسارة), quarry (محجر)
  // مواقع التفريغ النموذجية: mixer (خلاطة), dump_site (موقع تفريغ), project (موقع مشروع)
  const isLoadingStop = (stop: GpsStop) => {
    return stop.geofenceType === 'crusher' || stop.geofenceType === 'custom';
  };

  const isUnloadingStop = (stop: GpsStop) => {
    return (
      stop.geofenceType === 'mixer' ||
      stop.geofenceType === 'dump_site' ||
      stop.geofenceType === 'project'
    );
  };

  let haulCount = 0;
  let activeLoadingStop: GpsStop | null = null;

  for (let i = 0; i < stops.length; i++) {
    const currentStop = stops[i];

    if (isLoadingStop(currentStop)) {
      activeLoadingStop = currentStop;
      continue;
    }

    if (activeLoadingStop && isUnloadingStop(currentStop)) {
      // تم رصد دورة نقلة مكتملة بين التحميل والتفريغ
      haulCount++;
      const loadEndMs = new Date(activeLoadingStop.endTime).getTime();
      const unloadStartMs = new Date(currentStop.startTime).getTime();
      const durationMinutes = Math.max(1, Math.round(((unloadStartMs - loadEndMs) / 60000) * 10) / 10);

      // احتساب المسافة المقطوعة بين النقطتين من مسار النقاط المنظفة
      let travelDistKm = 0;
      if (cleanedPoints && cleanedPoints.length > 0) {
        for (const pt of cleanedPoints) {
          const ptTime = pt.timestamp.getTime();
          if (ptTime >= loadEndMs && ptTime <= unloadStartMs) {
            travelDistKm += pt.distanceKmFromPrev;
          }
        }
      }

      // إذا تعذر حساب المسار التفصيلي، نقدرها بالمسافة المباشرة كحد أدنى
      if (travelDistKm === 0) {
        travelDistKm = calculateDistanceKm(
          activeLoadingStop.centerLat,
          activeLoadingStop.centerLng,
          currentStop.centerLat,
          currentStop.centerLng
        );
      }

      hauls.push({
        id: `HAUL-${vehicleId}-${haulCount}-${activeLoadingStop.id}`,
        vehicleId,
        haulNumber: haulCount,
        startTime: activeLoadingStop.startTime,
        endTime: currentStop.endTime,
        durationMinutes,
        loadingStop: activeLoadingStop,
        unloadingStop: currentStop,
        travelDistanceKm: Math.round(travelDistKm * 10) / 10,
        status: 'completed'
      });

      // إعادة التعيين لانتظار النقلة التالية
      activeLoadingStop = null;
    }
  }

  // دعم النمط التبادلي للجرارات في حالة عدم وجود Geofences مخصصة:
  // إذا لم نجد أي نقلات لعدم اكتمال تصنيف الـ Geofences، نعتمد على تعاقب الوقفات المتباعدة (> 2 كم)
  if (hauls.length === 0 && stops.length >= 2) {
    for (let i = 0; i < stops.length - 1; i++) {
      const s1 = stops[i];
      const s2 = stops[i + 1];
      const dist = calculateDistanceKm(s1.centerLat, s1.centerLng, s2.centerLat, s2.centerLng);

      // إذا كانت المسافة بين الوقفتين أكبر من 3 كم، تُعتبر رحلة عمل / نقلة
      if (dist >= 3.0) {
        haulCount++;
        const s1End = new Date(s1.endTime).getTime();
        const s2Start = new Date(s2.startTime).getTime();
        const durationMinutes = Math.max(1, Math.round(((s2Start - s1End) / 60000) * 10) / 10);

        hauls.push({
          id: `HAUL-${vehicleId}-${haulCount}-${s1.id}`,
          vehicleId,
          haulNumber: haulCount,
          startTime: s1.startTime,
          endTime: s2.endTime,
          durationMinutes,
          loadingStop: s1,
          unloadingStop: s2,
          travelDistanceKm: Math.round(dist * 10) / 10,
          status: 'completed'
        });
      }
    }
  }

  return hauls;
}
