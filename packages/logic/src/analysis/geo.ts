/**
 * Badawi Fleet Platform — Geospatial Geometry Helpers
 * 
 * خوارزميات إحداثيات نقية 100% بلا أي مكتبات خارجية (Pure Math).
 */

import type { GeoCoordinate, Geofence } from './types.js';

const EARTH_RADIUS_KM = 6371.0;
const DEG_TO_RAD = Math.PI / 180;

/**
 * حساب المسافة بين نقطتين بالكيلومتر باستخدام صيغة Haversine
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * فحص ما إذا كانت النقطة تقع ضمن دائرة محددة بنصف قطر بالأمتار
 */
export function isPointInRadius(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): boolean {
  const distKm = calculateDistanceKm(lat, lng, centerLat, centerLng);
  return distKm * 1000 <= radiusMeters;
}

/**
 * فحص ما إذا كانت النقطة تقع داخل مضلع إحداثيات (Ray-Casting Algorithm)
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: GeoCoordinate[]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * مطابقة النقطة مع قائمة النطاقات الجغرافية (Geofences)
 * تدعم الفحص بالمضلع أولاً إذا كان معرّفاً، ثم النطاق الدائري
 */
export function findGeofenceForPoint(
  lat: number,
  lng: number,
  geofences: Geofence[]
): Geofence | null {
  if (!geofences || geofences.length === 0) return null;

  for (const fence of geofences) {
    if (fence.polygon && fence.polygon.length >= 3) {
      if (isPointInPolygon(lat, lng, fence.polygon)) {
        return fence;
      }
    } else if (fence.center && fence.radiusMeters > 0) {
      if (isPointInRadius(lat, lng, fence.center.lat, fence.center.lng, fence.radiusMeters)) {
        return fence;
      }
    }
  }

  return null;
}
