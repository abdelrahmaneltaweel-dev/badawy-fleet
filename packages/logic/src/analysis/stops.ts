/**
 * Badawi Fleet Platform — GPS Stops Aggregation & Geofence Matching
 * 
 * رصد وتجميع الوقفات ومطابقتها مع المواقع الجغرافية (جراج، كسارات، خلاطات، تفريغ، مشاريع)
 * واكتشاف وقفات الصيانة الدورية (20+ دقيقة بالجراج) وزيارات المواقع.
 */

import type { CleanGpsPoint, Geofence, GpsStop, AnalysisConfig } from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';
import { findGeofenceForPoint } from './geo.js';

export function detectStops(
  cleanedPoints: CleanGpsPoint[],
  geofences: Geofence[] = [],
  vehicleId: string = 'UNKNOWN',
  customConfig?: Partial<AnalysisConfig>
): GpsStop[] {
  if (!cleanedPoints || cleanedPoints.length === 0) {
    return [];
  }

  const config = { ...DEFAULT_ANALYSIS_CONFIG, ...customConfig };
  const stops: GpsStop[] = [];

  let currentCluster: CleanGpsPoint[] = [];

  const finalizeCluster = (cluster: CleanGpsPoint[], index: number) => {
    if (cluster.length === 0) return;

    const startPt = cluster[0];
    const endPt = cluster[cluster.length - 1];
    const durationMs = endPt.timestamp.getTime() - startPt.timestamp.getTime();
    const durationMinutes = Math.round((durationMs / 60000) * 10) / 10;

    // الوقفة تُعتمد إذا استمرت على الأقل الحد الأدنى للمدة المحددة (مثلاً 5 دقائق)
    if (durationMinutes >= config.minStopDurationMinutes) {
      let sumLat = 0;
      let sumLng = 0;
      let maxSpeed = 0;

      for (const p of cluster) {
        sumLat += p.latitude;
        sumLng += p.longitude;
        if (p.speed > maxSpeed) maxSpeed = p.speed;
      }

      const centerLat = Math.round((sumLat / cluster.length) * 1000000) / 1000000;
      const centerLng = Math.round((sumLng / cluster.length) * 1000000) / 1000000;

      // مطابقة الموقع الجغرافي
      const matchedFence = findGeofenceForPoint(centerLat, centerLng, geofences);

      // فحص وقفة الصيانة: وقوف في الجراج لمدة >= 20 دقيقة (D-059)
      const isInsideGarage = matchedFence?.type === 'garage';
      const isMaintenance = isInsideGarage && durationMinutes >= config.garageMaintenanceDurationMinutes;

      // فحص زيارة موقع عمل: وقوف 10+ دقائق بمشروع أو موقع مخصص
      const isSiteVisit = 
        (matchedFence?.type === 'project' || matchedFence?.type === 'custom') && 
        durationMinutes >= config.siteVisitDurationMinutes;

      stops.push({
        id: `STOP-${vehicleId}-${index}-${startPt.timestamp.getTime()}`,
        vehicleId,
        startTime: startPt.isoTime,
        endTime: endPt.isoTime,
        durationMinutes,
        centerLat,
        centerLng,
        geofenceId: matchedFence?.id,
        geofenceName: matchedFence?.name,
        geofenceType: matchedFence?.type,
        isMaintenance,
        isSiteVisit,
        maxSpeedDuringStop: maxSpeed,
        pointCount: cluster.length
      });
    }
  };

  let stopIndex = 1;

  for (const pt of cleanedPoints) {
    if (pt.speed <= config.stopSpeedThreshold) {
      currentCluster.push(pt);
    } else {
      if (currentCluster.length > 0) {
        finalizeCluster(currentCluster, stopIndex++);
        currentCluster = [];
      }
    }
  }

  // فحص آخر تجمع عند نهاية النقاط
  if (currentCluster.length > 0) {
    finalizeCluster(currentCluster, stopIndex);
  }

  return stops;
}
