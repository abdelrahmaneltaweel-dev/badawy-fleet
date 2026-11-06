/**
 * Badawi Fleet Platform — GPS Signal Cleaning & Outlier Filtering
 * 
 * خوارزمية تنظيف الإشارات الخام وحذف النقاط الشاذة والقفزات المستحيلة.
 */

import type { RawGpsPoint, CleanGpsPoint, AnalysisConfig } from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';
import { calculateDistanceKm } from './geo.js';

export function cleanAndFilterGpsPoints(
  rawPoints: RawGpsPoint[],
  customConfig?: Partial<AnalysisConfig>
): CleanGpsPoint[] {
  if (!rawPoints || rawPoints.length === 0) {
    return [];
  }

  const config = { ...DEFAULT_ANALYSIS_CONFIG, ...customConfig };

  // 1. تصفية أولية: التحقق من الصلاحية والإحداثيات والسرعة
  const parsedPoints: Array<{
    lat: number;
    lng: number;
    speed: number;
    ignition: boolean;
    time: Date;
    iso: string;
    course?: number;
  }> = [];

  for (const pt of rawPoints) {
    // التحقق من علم الصلاحية
    if (pt.valid === false || pt.valid === 0) {
      continue;
    }

    // التحقق من صحة الإحداثيات
    if (
      typeof pt.latitude !== 'number' ||
      typeof pt.longitude !== 'number' ||
      isNaN(pt.latitude) ||
      isNaN(pt.longitude) ||
      (pt.latitude === 0 && pt.longitude === 0) ||
      pt.latitude < -90 ||
      pt.latitude > 90 ||
      pt.longitude < -180 ||
      pt.longitude > 180
    ) {
      continue;
    }

    // التحقق من صحة السرعة وحذف السرعات الشاذة
    let speed = typeof pt.speed === 'number' && !isNaN(pt.speed) ? pt.speed : 0;
    if (speed < 0) speed = 0;
    if (speed > config.maxSpeedKmH) {
      // سرعة شاذة مستحيلة للأسطول
      continue;
    }

    // استخراج التوقيت
    const time = pt.timestamp instanceof Date ? pt.timestamp : new Date(pt.timestamp);
    if (isNaN(time.getTime())) {
      continue;
    }

    // حالة الكونتاكت (الافتراضي: شغال إذا السرعة > 3)
    const ignition = typeof pt.ignition === 'boolean' ? pt.ignition : (speed > 3);

    parsedPoints.push({
      lat: pt.latitude,
      lng: pt.longitude,
      speed,
      ignition,
      time,
      iso: time.toISOString(),
      course: typeof pt.course === 'number' ? pt.course : undefined
    });
  }

  // 2. الفرز الزمني الصاعد وإزالة التكرار الزمني
  parsedPoints.sort((a, b) => a.time.getTime() - b.time.getTime());

  const uniquePoints: typeof parsedPoints = [];
  let lastTimeMs = -1;

  for (const p of parsedPoints) {
    const curTimeMs = p.time.getTime();
    if (curTimeMs === lastTimeMs) {
      // نفس التوقيت بالمللي ثانية، نحتفظ بالنقطة الأكثر سرعة أو ذات حركة
      const prev = uniquePoints[uniquePoints.length - 1];
      if (prev && p.speed > prev.speed) {
        uniquePoints[uniquePoints.length - 1] = p;
      }
    } else {
      uniquePoints.push(p);
      lastTimeMs = curTimeMs;
    }
  }

  if (uniquePoints.length === 0) {
    return [];
  }

  // 2.5 تصحيح السرعة الوهمية للعربيات الصعبة (FREEZE_FIX لمركبات مثل 124)
  if (config.freezeFix) {
    for (let i = 1; i < uniquePoints.length; i++) {
      const prev = uniquePoints[i - 1];
      const cur = uniquePoints[i];
      if (cur.speed > 0 && cur.speed <= 15) {
        const distKm = calculateDistanceKm(prev.lat, prev.lng, cur.lat, cur.lng);
        // إزاحة أقل من 15 متر مع سرعة وهمية <= 15 كم/س = تصفير السرعة
        if (distKm < 0.015) {
          cur.speed = 0;
          cur.ignition = false;
        }
      }
    }
  }

  // 3. تصفية القفزات المستحيلة (Teleportation Jitter Filter) وحساب المسافات
  const cleaned: CleanGpsPoint[] = [];

  for (let i = 0; i < uniquePoints.length; i++) {
    const cur = uniquePoints[i];

    if (cleaned.length === 0) {
      cleaned.push({
        latitude: cur.lat,
        longitude: cur.lng,
        speed: cur.speed,
        ignition: cur.ignition,
        timestamp: cur.time,
        isoTime: cur.iso,
        distanceKmFromPrev: 0,
        timeDiffSeconds: 0,
        course: cur.course
      });
      continue;
    }

    const prev = cleaned[cleaned.length - 1];
    const timeDiffSeconds = Math.max(1, (cur.time.getTime() - prev.timestamp.getTime()) / 1000);
    const distKm = calculateDistanceKm(prev.latitude, prev.longitude, cur.lat, cur.lng);
    const impliedSpeedKmH = (distKm / (timeDiffSeconds / 3600));

    // إذا كانت السرعة المحسوبة مستحيلة، وكان هناك نقطة لاحقة تعود للموقع الأصلي، فهذه قفزة GPS شاذة
    if (impliedSpeedKmH > config.maxTeleportSpeedKmH) {
      if (i + 1 < uniquePoints.length) {
        const next = uniquePoints[i + 1];
        const distToNextFromPrev = calculateDistanceKm(prev.latitude, prev.longitude, next.lat, next.lng);
        const timeToNextSeconds = (next.time.getTime() - prev.timestamp.getTime()) / 1000;
        const speedToNext = (distToNextFromPrev / (Math.max(1, timeToNextSeconds) / 3600));

        // إذا كان الموقع التالي يعود لقرب الموقع السابق بسرعة معقولة، نتجاهل القفزة الحالية
        if (speedToNext <= config.maxSpeedKmH) {
          continue;
        }
      }
    }

    cleaned.push({
      latitude: cur.lat,
      longitude: cur.lng,
      speed: cur.speed,
      ignition: cur.ignition,
      timestamp: cur.time,
      isoTime: cur.iso,
      distanceKmFromPrev: Math.round(distKm * 1000) / 1000,
      timeDiffSeconds: Math.round(timeDiffSeconds),
      course: cur.course
    });
  }

  return cleaned;
}
