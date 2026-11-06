/**
 * Badawi Fleet Platform — Tests for Overrides by Fingerprint (T4.4)
 * Node.js Native Test Runner (Zero Network, 100% Pure Functions)
 * 
 * المرجع: docs/PROJECT_FRAMEWORK.md (T4.4)
 * معيار القبول: تعديل يدوي يصمد أمام تحسين الكود وإعادة التحليل بنسبة 100%.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashString,
  computeHaulFingerprint,
  computeTripFingerprint,
  parseFingerprint,
  isFingerprintMatch,
  createEntityOverride,
  createTombstoneOverride,
  applyOverridesToHauls,
  applyOverridesToTrips,
  applyOverridesToDailyAnalysis,
  analyzeVehicleDailyData
} from '../dist/index.js';

test('1. Deterministic Fingerprint Generation & Parsing', () => {
  const haul = {
    id: 'HAUL-116-1',
    vehicleId: '116',
    haulNumber: 1,
    startTime: '2026-10-18T07:00:00Z',
    endTime: '2026-10-18T07:45:00Z',
    durationMinutes: 45,
    loadingStop: {
      id: 'S1',
      vehicleId: '116',
      startTime: '2026-10-18T07:00:00Z',
      endTime: '2026-10-18T07:10:00Z',
      durationMinutes: 10,
      centerLat: 31.0200,
      centerLng: 29.7200,
      geofenceType: 'crusher',
      isMaintenance: false,
      isSiteVisit: true,
      maxSpeedDuringStop: 0,
      pointCount: 10
    },
    unloadingStop: {
      id: 'S2',
      vehicleId: '116',
      startTime: '2026-10-18T07:35:00Z',
      endTime: '2026-10-18T07:45:00Z',
      durationMinutes: 10,
      centerLat: 31.1500,
      centerLng: 29.8500,
      geofenceType: 'dump_site',
      isMaintenance: false,
      isSiteVisit: true,
      maxSpeedDuringStop: 0,
      pointCount: 10
    },
    travelDistanceKm: 24.5,
    status: 'completed'
  };

  const sig = computeHaulFingerprint(haul);
  assert.ok(sig, 'يجب توليد بصمة للنقلة');
  assert.ok(sig.includes('|'), 'صيغة البصمة يجب أن تحتوي على فواصل');

  const parsed = parseFingerprint(sig);
  assert.ok(parsed !== null);
  assert.strictEqual(parsed.hash.length, 8, 'الهاش يجب أن يكون 8 خانات hex');
  assert.strictEqual(parsed.startSec, Math.floor(new Date(haul.startTime).getTime() / 1000));
  assert.strictEqual(parsed.endSec, Math.floor(new Date(haul.endTime).getTime() / 1000));
});

test('2. Fingerprint Tolerance & Matching Across Time Jitter', () => {
  const baseTime = 1760770800; // Epoch seconds
  const sig1 = `a1b2c3d4|${baseTime}|${baseTime + 2700}`; // 45 min cycle
  
  // نفس البصمة
  assert.strictEqual(isFingerprintMatch(sig1, sig1), true);

  // بصمة أخرى لنفس الدورة زحزحت دقيقتين (120 ثانية) بسبب فلتر تنظيف الإشارة
  const sigShifted = `f9e8d7c6|${baseTime + 120}|${baseTime + 2820}`;
  assert.strictEqual(
    isFingerprintMatch(sig1, sigShifted, 300),
    true,
    'يجب أن تتطابق البصمة مع زحزحة زمنية بسيطة ضمن حد السماحية'
  );

  // بصمة لدورة في وقت مختلف تماماً (بعد 4 ساعات) -> يجب ألا تتطابق
  const sigDifferent = `x9y8z7w6|${baseTime + 14400}|${baseTime + 17100}`;
  assert.strictEqual(isFingerprintMatch(sig1, sigDifferent, 300), false);
});

test('3. Override Operations: Update, Tombstone (Delete), and Insert', () => {
  const dummyHauls = [
    {
      id: 'HAUL-1',
      vehicleId: '118',
      haulNumber: 1,
      startTime: '2026-10-18T08:00:00Z',
      endTime: '2026-10-18T08:50:00Z',
      durationMinutes: 50,
      loadingStop: { id: 's1', vehicleId: '118', startTime: '2026-10-18T08:00:00Z', endTime: '2026-10-18T08:10:00Z', durationMinutes: 10, centerLat: 31.02, centerLng: 29.72, geofenceType: 'crusher', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      unloadingStop: { id: 's2', vehicleId: '118', startTime: '2026-10-18T08:40:00Z', endTime: '2026-10-18T08:50:00Z', durationMinutes: 10, centerLat: 31.15, centerLng: 29.85, geofenceType: 'dump_site', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      travelDistanceKm: 25.0,
      status: 'completed'
    },
    {
      id: 'HAUL-2',
      vehicleId: '118',
      haulNumber: 2,
      startTime: '2026-10-18T09:30:00Z',
      endTime: '2026-10-18T10:15:00Z',
      durationMinutes: 45,
      loadingStop: { id: 's3', vehicleId: '118', startTime: '2026-10-18T09:30:00Z', endTime: '2026-10-18T09:40:00Z', durationMinutes: 10, centerLat: 31.02, centerLng: 29.72, geofenceType: 'crusher', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      unloadingStop: { id: 's4', vehicleId: '118', startTime: '2026-10-18T10:05:00Z', endTime: '2026-10-18T10:15:00Z', durationMinutes: 10, centerLat: 31.15, centerLng: 29.85, geofenceType: 'dump_site', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      travelDistanceKm: 24.8,
      status: 'completed'
    },
    {
      id: 'HAUL-3',
      vehicleId: '118',
      haulNumber: 3,
      startTime: '2026-10-18T11:00:00Z',
      endTime: '2026-10-18T11:40:00Z',
      durationMinutes: 40,
      loadingStop: { id: 's5', vehicleId: '118', startTime: '2026-10-18T11:00:00Z', endTime: '2026-10-18T11:10:00Z', durationMinutes: 10, centerLat: 31.02, centerLng: 29.72, geofenceType: 'crusher', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      unloadingStop: { id: 's6', vehicleId: '118', startTime: '2026-10-18T11:30:00Z', endTime: '2026-10-18T11:40:00Z', durationMinutes: 10, centerLat: 31.15, centerLng: 29.85, geofenceType: 'dump_site', isMaintenance: false, isSiteVisit: true, maxSpeedDuringStop: 0, pointCount: 5 },
      travelDistanceKm: 26.2,
      status: 'completed'
    }
  ];

  // 1. تعديل مسافة النقلة 1 إلى 32.0 كم
  const sig1 = computeHaulFingerprint(dummyHauls[0]);
  const updateOvr = createEntityOverride({
    vehicleId: '118',
    operationalDate: '2026-10-18',
    target: 'haul',
    kind: 'update',
    fingerprint: sig1,
    payload: { travelDistanceKm: 32.0, note: 'تعديل مسافة اعتماداً على بون الميزان' },
    reason: 'تحويلة طريق الساحلي المعتمدة ببيان الخلاطة',
    appliedBy: 'admin-01'
  });

  // 2. حذف النقلة رقم 2 كشاهد قبر (Tombstone) لأنها كانت مشوار خاص
  const tombstoneOvr = createTombstoneOverride(
    dummyHauls[1],
    'haul',
    'استبعاد نقلة وهمية (العربية كانت في مشوار صيانة غير محمل)',
    'supervisor-01'
  );

  // 3. إضافة نقلة يدوية رقم 4 لم يرصدها الـ GPS
  const insertOvr = createEntityOverride({
    vehicleId: '118',
    operationalDate: '2026-10-18',
    target: 'haul',
    kind: 'insert',
    fingerprint: 'manual-insert-04',
    timeWindow: {
      start: '2026-10-18T13:00:00Z',
      end: '2026-10-18T13:45:00Z'
    },
    payload: {
      travelDistanceKm: 28.0,
      loadingLocationName: 'كسارة الكيلو 21',
      unloadingLocationName: 'محطة خلاطة برج العرب'
    },
    reason: 'إضافة نقلة من بون الخلاطة الورقي وقت انقطاع فيوز الـ GPS',
    appliedBy: 'admin-01'
  });

  const { hauls: overlaidHauls, applied, audit } = applyOverridesToHauls(
    dummyHauls,
    [updateOvr, tombstoneOvr, insertOvr],
    '118'
  );

  // فحص النتائج:
  // - الأصل 3 نقلات
  // - تم حذف النقلة 2
  // - تم تعديل النقلة 1
  // - تم إدخال نقلة جديدة
  // النتيجة النهائية: 3 نقلات (1 معدلة، 3 الأصلية أصبحت 2، ونقلة مدخلة أصبحت 3)
  assert.strictEqual(overlaidHauls.length, 3, 'عدد النقلات الإجمالي بعد التعديل يجب أن يكون 3');
  assert.strictEqual(applied.length, 3, 'يجب تطبيق الـ 3 تعديلات بنجاح');
  assert.strictEqual(audit.length, 3, 'يجب تسجيل 3 عمليات في سجل التدقيق');

  // فحص النقلة الأولى (المعدلة)
  const h1 = overlaidHauls[0];
  assert.strictEqual(h1.haulNumber, 1);
  assert.strictEqual(h1.travelDistanceKm, 32.0, 'مسافة النقلة الأولى تم تعديلها إلى 32 كم');
  assert.strictEqual(h1.isOverridden, true);
  assert.strictEqual(h1.overrideId, updateOvr.id);

  // فحص أن النقلة الثانية المحذوفة لم تعد موجودة
  assert.ok(
    !overlaidHauls.some((h) => h.startTime === dummyHauls[1].startTime),
    'النقلة المحذوفة يجب استبعادها تماماً'
  );

  // فحص النقلة المضافة يدوياً
  const hLast = overlaidHauls[2];
  assert.strictEqual(hLast.haulNumber, 3);
  assert.strictEqual(hLast.travelDistanceKm, 28.0);
  assert.strictEqual(hLast.isOverridden, true);
});

test('4. Core Acceptance Criterion: Overrides SURVIVE Code Improvements & Re-analysis', () => {
  // محاكاة يوم تشغيلي لعربية جرار ينتج 4 نقلات
  const geofences = [
    { id: 'CRUSHER', name: 'الكسارة', type: 'crusher', center: { lat: 31.0200, lng: 29.7200 }, radiusMeters: 4500 },
    { id: 'DOWLY', name: 'الدولي', type: 'dump_site', center: { lat: 31.1500, lng: 29.8500 }, radiusMeters: 2500 }
  ];

  const generateShiftPoints = (noiseJitterMinutes = 0) => {
    const points = [];
    let curTime = new Date('2026-10-18T06:00:00Z').getTime() + (noiseJitterMinutes * 60000);

    for (let c = 1; c <= 4; c++) {
      // وقفة تحميل (8 دقائق = 8 نقاط)
      for (let i = 0; i < 8; i++) {
        points.push({
          vehicleId: '116',
          latitude: 31.0200,
          longitude: 29.7200,
          speed: 0,
          valid: true,
          ignition: true,
          timestamp: new Date(curTime).toISOString()
        });
        curTime += 60000;
      }
      // حركة بين الكسارة وموقع التفريغ (مسار بين الموقعين)
      for (let t = 1; t <= 4; t++) {
        points.push({
          vehicleId: '116',
          latitude: 31.0200 + (t * 0.025),
          longitude: 29.7200 + (t * 0.025),
          speed: 48,
          valid: true,
          ignition: true,
          timestamp: new Date(curTime).toISOString()
        });
        curTime += 60000;
      }
      // وقفة تفريغ في الدولي (8 دقائق = 8 نقاط)
      for (let i = 0; i < 8; i++) {
        points.push({
          vehicleId: '116',
          latitude: 31.1500,
          longitude: 29.8500,
          speed: 0,
          valid: true,
          ignition: true,
          timestamp: new Date(curTime).toISOString()
        });
        curTime += 60000;
      }
      // عودة من الدولي إلى الكسارة
      for (let r = 1; r <= 4; r++) {
        points.push({
          vehicleId: '116',
          latitude: 31.1500 - (r * 0.025),
          longitude: 29.8500 - (r * 0.025),
          speed: 52,
          valid: true,
          ignition: true,
          timestamp: new Date(curTime).toISOString()
        });
        curTime += 60000;
      }
    }
    return points;
  };

  // 1. تشغيل التحليل المبدئي
  const rawPointsV1 = generateShiftPoints(0);
  const initialResult = analyzeVehicleDailyData(
    { id: '116', type: 'tractor' },
    rawPointsV1,
    geofences,
    '2026-10-18'
  );
  assert.strictEqual(initialResult.hauls.length, 4, 'التحليل المبدئي يجب أن يكتشف 4 نقلات');

  // 2. المسؤول يقوم بتطبيق تعديلات بالبصمة:
  // - تعديل مسافة النقلة 2 لتصبح 35 كم بدلاً من المسافة المحسوبة
  // - حذف النقلة 3 كـ Tombstone (نقلة ملغاة)
  const haul2Sig = computeHaulFingerprint(initialResult.hauls[1]);
  const updateOverride = createEntityOverride({
    vehicleId: '116',
    operationalDate: '2026-10-18',
    target: 'haul',
    kind: 'update',
    fingerprint: haul2Sig,
    payload: { travelDistanceKm: 35.0 },
    reason: 'اعتماد المسار البديل من كارتة الطريق',
    appliedBy: 'manager-ahmed'
  });

  const tombstoneOverride = createTombstoneOverride(
    initialResult.hauls[2],
    'haul',
    'نقلة تجريبية غير مسجلة في بيان الخلاطة',
    'manager-ahmed'
  );

  const storedOverrides = [updateOverride, tombstoneOverride];

  // 3. محاكاة تحسين الكود وإعادة التحليل (Code Improvement & Re-run):
  // - تم تحسين خوارزمية تنظيف الإشارة، وتغيرت إعدادات التصفية
  // - تغيرت أوقات الوقفات قليلاً (زحزحة دقيقتين) وتغيرت بعض المسافات في التحليل الخام
  const rawPointsV2 = generateShiftPoints(2); // زحزحة دقيقتين لمحاكاة تغير معالجة النقاط
  const improvedDailyResult = analyzeVehicleDailyData(
    { id: '116', type: 'tractor' },
    rawPointsV2,
    geofences,
    '2026-10-18',
    undefined,
    { stopSpeedThreshold: 4, minStopDurationMinutes: 6 } // إعدادات محسنة
  );

  assert.strictEqual(improvedDailyResult.hauls.length, 4, 'التحليل الجديد أنتج 4 نقلات خام');

  // 4. تطبيق التعديلات المحفوظة على نتيجة التحليل الجديدة
  const finalOverlaid = applyOverridesToDailyAnalysis(improvedDailyResult, storedOverrides);

  // التحقق الحاسم من صمود التعديلات اليدوية (Acceptance Criteria):
  // أ. التعديلات طُبقت بنجاح ولم تفقد الارتباط
  assert.strictEqual(finalOverlaid.isOverridden, true);
  assert.strictEqual(finalOverlaid.overridesAppliedCount, 2);

  // ب. النقلة المحذوفة ظلت محذوفة (3 نقلات بدلاً من 4)
  assert.strictEqual(
    finalOverlaid.hauls.length,
    3,
    'صمود شاهد القبر (Tombstone): النقلة الملغاة لم تعد للظهور حتى بعد إعادة تشغيل الكود'
  );

  // ج. النقلة المعدلة حافظت على قيمتها المعدلة يدوياً (35 كم) بدقة
  const updatedHaul = finalOverlaid.hauls.find((h) => h.isOverridden && h.travelDistanceKm === 35.0);
  assert.ok(
    updatedHaul !== undefined,
    'صمود التعديل اليدوي: قيمة 35.0 كم ظلت ثابتة على نفس النقلة الحقيقية بعد إعادة التحليل'
  );

  // د. توثيق سجل التدقيق بالكامل
  assert.strictEqual(finalOverlaid.overridesAudit.length, 2);
  assert.strictEqual(finalOverlaid.overridesAudit[0].appliedBy, 'manager-ahmed');
});
