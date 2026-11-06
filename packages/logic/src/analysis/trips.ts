/**
 * Badawi Fleet Platform — Vehicle Trips Detection (المشاوير لعربيات النقل والملاكي)
 * 
 * المرجع: docs/adr/ADR-059 (مشاوير أمس لعربيات النقل والملاكي)
 * تقسيم مسار اليوم إلى مشاوير منفصلة بين الوقفات الرئيسية واحتساب الكيلومترات والسرعات.
 */

import type { CleanGpsPoint, GpsStop, Geofence, VehicleTrip, AnalysisConfig } from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';
import { findGeofenceForPoint } from './geo.js';

export function detectVehicleTrips(
  cleanedPoints: CleanGpsPoint[],
  stops: GpsStop[],
  geofences: Geofence[] = [],
  vehicleId: string = 'UNKNOWN',
  customConfig?: Partial<AnalysisConfig>
): VehicleTrip[] {
  if (!cleanedPoints || cleanedPoints.length === 0) {
    return [];
  }

  const config = { ...DEFAULT_ANALYSIS_CONFIG, ...customConfig };
  const trips: VehicleTrip[] = [];

  // إذا لم تكن هناك وقفات مسجلة باليوم، لكن هناك حركة مستمرة، نعتبر اليوم كله مشواراً واحداً
  if (stops.length === 0) {
    let totalDist = 0;
    let movingMinutes = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let movingPointsCount = 0;

    for (const pt of cleanedPoints) {
      totalDist += pt.distanceKmFromPrev;
      if (pt.speed > config.stopSpeedThreshold) {
        movingMinutes += (pt.timeDiffSeconds / 60);
        if (pt.speed > maxSpeed) maxSpeed = pt.speed;
        speedSum += pt.speed;
        movingPointsCount++;
      }
    }

    if (totalDist > 0.5) {
      const firstPt = cleanedPoints[0];
      const lastPt = cleanedPoints[cleanedPoints.length - 1];
      const startFence = findGeofenceForPoint(firstPt.latitude, firstPt.longitude, geofences);
      const endFence = findGeofenceForPoint(lastPt.latitude, lastPt.longitude, geofences);
      const durationMin = Math.max(1, (lastPt.timestamp.getTime() - firstPt.timestamp.getTime()) / 60000);

      trips.push({
        id: `TRIP-${vehicleId}-1-${firstPt.timestamp.getTime()}`,
        vehicleId,
        tripNumber: 1,
        startTime: firstPt.isoTime,
        endTime: lastPt.isoTime,
        durationMinutes: Math.round(durationMin * 10) / 10,
        startLocation: {
          lat: firstPt.latitude,
          lng: firstPt.longitude,
          name: startFence?.name || 'موقع البداية'
        },
        endLocation: {
          lat: lastPt.latitude,
          lng: lastPt.longitude,
          name: endFence?.name || 'موقع الوصول'
        },
        distanceKm: Math.round(totalDist * 10) / 10,
        movingMinutes: Math.round(movingMinutes * 10) / 10,
        stopMinutes: Math.max(0, Math.round((durationMin - movingMinutes) * 10) / 10),
        maxSpeedKmH: Math.round(maxSpeed * 10) / 10,
        avgSpeedKmH: movingPointsCount > 0 ? Math.round((speedSum / movingPointsCount) * 10) / 10 : 0,
        intermediateStops: []
      });
    }

    return trips;
  }

  // في حالة وجود وقفات، يتم تكوين مشوار بين نهاية كل وقفة وبداية الوقفة التالية
  // بالإضافة للمسار قبل أول وقفة والمسار بعد آخر وقفة
  let tripCounter = 0;

  // 1. المسار قبل أول وقفة
  const firstStop = stops[0];
  const firstStopStartMs = new Date(firstStop.startTime).getTime();
  const preStopPoints = cleanedPoints.filter(p => p.timestamp.getTime() < firstStopStartMs);

  if (preStopPoints.length > 5) {
    const trip = buildTripFromSegment(
      preStopPoints,
      tripCounter + 1,
      vehicleId,
      geofences,
      config
    );
    if (trip && trip.distanceKm >= 0.5) {
      tripCounter++;
      trips.push(trip);
    }
  }

  // 2. المشاوير بين الوقفات المتتالية
  for (let i = 0; i < stops.length - 1; i++) {
    const curStop = stops[i];
    const nextStop = stops[i + 1];

    const curEndMs = new Date(curStop.endTime).getTime();
    const nextStartMs = new Date(nextStop.startTime).getTime();

    const segmentPoints = cleanedPoints.filter(
      p => p.timestamp.getTime() >= curEndMs && p.timestamp.getTime() <= nextStartMs
    );

    if (segmentPoints.length > 0) {
      const trip = buildTripFromSegment(
        segmentPoints,
        tripCounter + 1,
        vehicleId,
        geofences,
        config,
        curStop,
        nextStop
      );
      if (trip && (trip.distanceKm >= 0.3 || trip.movingMinutes >= 2)) {
        tripCounter++;
        trips.push(trip);
      }
    }
  }

  // 3. المسار بعد آخر وقفة
  const lastStop = stops[stops.length - 1];
  const lastStopEndMs = new Date(lastStop.endTime).getTime();
  const postStopPoints = cleanedPoints.filter(p => p.timestamp.getTime() > lastStopEndMs);

  if (postStopPoints.length > 5) {
    const trip = buildTripFromSegment(
      postStopPoints,
      tripCounter + 1,
      vehicleId,
      geofences,
      config,
      lastStop,
      undefined
    );
    if (trip && trip.distanceKm >= 0.5) {
      tripCounter++;
      trips.push(trip);
    }
  }

  return trips;
}

function buildTripFromSegment(
  points: CleanGpsPoint[],
  tripNumber: number,
  vehicleId: string,
  geofences: Geofence[],
  config: AnalysisConfig,
  startStop?: GpsStop,
  endStop?: GpsStop
): VehicleTrip | null {
  if (!points || points.length === 0) return null;

  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const startTime = startStop ? startStop.endTime : firstPt.isoTime;
  const endTime = endStop ? endStop.startTime : lastPt.isoTime;

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const durationMin = Math.max(1, Math.round(((endMs - startMs) / 60000) * 10) / 10);

  let totalDistKm = 0;
  let movingMinutes = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let movingPointsCount = 0;

  for (const pt of points) {
    totalDistKm += pt.distanceKmFromPrev;
    if (pt.speed > config.stopSpeedThreshold) {
      movingMinutes += (pt.timeDiffSeconds / 60);
      if (pt.speed > maxSpeed) maxSpeed = pt.speed;
      speedSum += pt.speed;
      movingPointsCount++;
    }
  }

  const startFence = startStop?.geofenceName
    ? { name: startStop.geofenceName }
    : findGeofenceForPoint(firstPt.latitude, firstPt.longitude, geofences);

  const endFence = endStop?.geofenceName
    ? { name: endStop.geofenceName }
    : findGeofenceForPoint(lastPt.latitude, lastPt.longitude, geofences);

  return {
    id: `TRIP-${vehicleId}-${tripNumber}-${firstPt.timestamp.getTime()}`,
    vehicleId,
    tripNumber,
    startTime,
    endTime,
    durationMinutes: durationMin,
    startLocation: {
      lat: startStop ? startStop.centerLat : firstPt.latitude,
      lng: startStop ? startStop.centerLng : firstPt.longitude,
      name: startFence?.name || (startStop ? startStop.geofenceName : 'بداية المشوار')
    },
    endLocation: {
      lat: endStop ? endStop.centerLat : lastPt.latitude,
      lng: endStop ? endStop.centerLng : lastPt.longitude,
      name: endFence?.name || (endStop ? endStop.geofenceName : 'نهاية المشوار')
    },
    distanceKm: Math.round(totalDistKm * 10) / 10,
    movingMinutes: Math.round(movingMinutes * 10) / 10,
    stopMinutes: Math.max(0, Math.round((durationMin - movingMinutes) * 10) / 10),
    maxSpeedKmH: Math.round(maxSpeed * 10) / 10,
    avgSpeedKmH: movingPointsCount > 0 ? Math.round((speedSum / movingPointsCount) * 10) / 10 : 0,
    intermediateStops: []
  };
}
