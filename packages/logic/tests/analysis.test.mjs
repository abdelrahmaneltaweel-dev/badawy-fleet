/**
 * Badawi Fleet Platform — Tests for Pure Analysis Module (T4.1)
 * Node.js Native Test Runner (Zero Network, 100% Pure Functions)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceKm,
  isPointInRadius,
  isPointInPolygon,
  findGeofenceForPoint,
  cleanAndFilterGpsPoints,
  detectStops,
  detectHaulCycles,
  detectVehicleTrips,
  evaluateVehicleGpsStatus,
  analyzeVehicleDailyData,
  getOperationalDateString,
  DEFAULT_ANALYSIS_CONFIG
} from '../dist/index.js';

test('1. Geo Functions (Haversine & Geofencing)', () => {
  // المسافة بين نقطتين معروفتين في الإسكندرية (محطة الرمل وسيدي جابر ~ 4.5 كم)
  const dist = calculateDistanceKm(31.2001, 29.8999, 31.2156, 29.9450);
  assert.ok(dist > 4.0 && dist < 5.0, `المسافة المقاسة ${dist} كم غير دقيقة`);

  // المسافة بين نفس النقطة = 0
  assert.equal(calculateDistanceKm(31.2, 29.9, 31.2, 29.9), 0);

  // فحص النطاق الدائري (Radius check)
  assert.equal(isPointInRadius(31.2001, 29.8999, 31.2005, 29.9002, 100), true);
  assert.equal(isPointInRadius(31.2001, 29.8999, 31.2500, 29.9500, 500), false);

  // فحص المضلع (Polygon ray-casting)
  const polygon = [
    { lat: 31.0, lng: 30.0 },
    { lat: 31.0, lng: 30.1 },
    { lat: 31.1, lng: 30.1 },
    { lat: 31.1, lng: 30.0 }
  ];
  assert.equal(isPointInPolygon(31.05, 30.05, polygon), true);
  assert.equal(isPointInPolygon(31.2, 30.2, polygon), false);

  // مطابقة الـ Geofences
  const fences = [
    {
      id: 'FENCE-GARAGE',
      name: 'جراج العجمي الرئيسي',
      type: 'garage',
      center: { lat: 31.1000, lng: 29.8000 },
      radiusMeters: 300
    },
    {
      id: 'FENCE-CRUSHER',
      name: 'كسارة العامرية',
      type: 'crusher',
      center: { lat: 31.0500, lng: 29.7500 },
      radiusMeters: 500
    }
  ];

  const matched = findGeofenceForPoint(31.1001, 29.8001, fences);
  assert.ok(matched !== null);
  assert.equal(matched.id, 'FENCE-GARAGE');
  assert.equal(matched.type, 'garage');

  const outside = findGeofenceForPoint(31.5, 30.5, fences);
  assert.equal(outside, null);
});

test('2. Signal Cleaner & Outlier Filter', () => {
  const baseTime = new Date('2026-11-06T08:00:00Z');
  const rawPings = [
    // نقطة صالحة
    {
      vehicleId: 'TRUCK-101',
      latitude: 31.1000,
      longitude: 29.8000,
      speed: 40,
      valid: true,
      timestamp: new Date(baseTime.getTime()).toISOString()
    },
    // نقطة غير صالحة (valid = false) -> يجب حذفها
    {
      vehicleId: 'TRUCK-101',
      latitude: 31.1020,
      longitude: 29.8020,
      speed: 45,
      valid: false,
      timestamp: new Date(baseTime.getTime() + 60000).toISOString()
    },
    // نقطة بإحداثيات شاذة (0,0) -> يجب حذفها
    {
      vehicleId: 'TRUCK-101',
      latitude: 0,
      longitude: 0,
      speed: 30,
      valid: true,
      timestamp: new Date(baseTime.getTime() + 120000).toISOString()
    },
    // سرعة شاذة مستحيلة (250 كم/س) -> يجب حذفها
    {
      vehicleId: 'TRUCK-101',
      latitude: 31.1050,
      longitude: 29.8050,
      speed: 250,
      valid: true,
      timestamp: new Date(baseTime.getTime() + 180000).toISOString()
    },
    // نقطة صالحة تالية
    {
      vehicleId: 'TRUCK-101',
      latitude: 31.1060,
      longitude: 29.8060,
      speed: 55,
      valid: true,
      timestamp: new Date(baseTime.getTime() + 240000).toISOString()
    }
  ];

  const cleaned = cleanAndFilterGpsPoints(rawPings);
  assert.equal(cleaned.length, 2, 'يجب قبول النقطتين الصالحتين فقط واستبعاد الـ 3 نقاط المعيبة');
  assert.equal(cleaned[0].latitude, 31.1000);
  assert.equal(cleaned[1].latitude, 31.1060);
  assert.ok(cleaned[1].distanceKmFromPrev > 0);
  assert.ok(cleaned[1].timeDiffSeconds > 0);
});

test('3. Stops Aggregation & Garage Maintenance Detection', () => {
  const baseTime = new Date('2026-11-06T10:00:00Z');
  const geofences = [
    {
      id: 'GARAGE-1',
      name: 'الجراج الرئيسي',
      type: 'garage',
      center: { lat: 31.1000, lng: 29.8000 },
      radiusMeters: 400
    }
  ];

  // توليد 25 نقطة توقف في الجراج (نقطة كل دقيقة = 24 دقيقة توقف)
  const pings = [];
  for (let i = 0; i < 25; i++) {
    pings.push({
      vehicleId: 'TRUCK-102',
      latitude: 31.1001 + (i * 0.00001),
      longitude: 29.8001 + (i * 0.00001),
      speed: 0,
      valid: true,
      timestamp: new Date(baseTime.getTime() + i * 60000).toISOString()
    });
  }

  // إضافة حركة بعد ذلك
  for (let i = 25; i < 35; i++) {
    pings.push({
      vehicleId: 'TRUCK-102',
      latitude: 31.1001 + (i * 0.005),
      longitude: 29.8001 + (i * 0.005),
      speed: 50,
      valid: true,
      timestamp: new Date(baseTime.getTime() + i * 60000).toISOString()
    });
  }

  const cleaned = cleanAndFilterGpsPoints(pings);
  const stops = detectStops(cleaned, geofences, 'TRUCK-102');

  assert.equal(stops.length, 1, 'يجب رصد وقفة واحدة');
  const stop = stops[0];
  assert.ok(stop.durationMinutes >= 20, `مدة الوقفة ${stop.durationMinutes} دقيقة يجب أن تكون 24`);
  assert.equal(stop.geofenceType, 'garage');
  assert.equal(stop.isMaintenance, true, 'وقفة الجراج لمدة أكثر من 20 دقيقة يجب اعتبارها صيانة (D-059)');
});

test('4. Haul Cycles Detection for Tractors', () => {
  const baseTime = new Date('2026-11-06T06:00:00Z');
  const geofences = [
    {
      id: 'CRUSHER-1',
      name: 'كسارة الكيلو 21',
      type: 'crusher',
      center: { lat: 31.0000, lng: 29.7000 },
      radiusMeters: 500
    },
    {
      id: 'MIXER-1',
      name: 'محطة خرسانة برج العرب',
      type: 'mixer',
      center: { lat: 30.9000, lng: 29.6000 },
      radiusMeters: 500
    }
  ];

  const pings = [];
  let timeOffsetMin = 0;

  // 1. وقفة تحميل في الكسارة (10 دقائق)
  for (let i = 0; i < 10; i++) {
    pings.push({
      vehicleId: 'TRACTOR-01',
      latitude: 31.0001,
      longitude: 29.7001,
      speed: 0,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeOffsetMin++) * 60000).toISOString()
    });
  }

  // 2. مسار السير المحمل (30 دقيقة سرعة 45 كم/س)
  for (let i = 0; i < 30; i++) {
    pings.push({
      vehicleId: 'TRACTOR-01',
      latitude: 31.0000 - (i * 0.0033),
      longitude: 29.7000 - (i * 0.0033),
      speed: 45,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeOffsetMin++) * 60000).toISOString()
    });
  }

  // 3. وقفة تفريغ في الخلاطة (12 دقيقة)
  for (let i = 0; i < 12; i++) {
    pings.push({
      vehicleId: 'TRACTOR-01',
      latitude: 30.9001,
      longitude: 29.6001,
      speed: 0,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeOffsetMin++) * 60000).toISOString()
    });
  }

  const cleaned = cleanAndFilterGpsPoints(pings);
  const stops = detectStops(cleaned, geofences, 'TRACTOR-01');
  assert.equal(stops.length, 2, 'يجب رصد وقفتين: تحميل وتفريغ');

  const hauls = detectHaulCycles(cleaned, stops, 'TRACTOR-01');
  assert.equal(hauls.length, 1, 'يجب رصد نقلة واحدة مكتملة');
  assert.equal(hauls[0].haulNumber, 1);
  assert.equal(hauls[0].loadingStop.geofenceType, 'crusher');
  assert.equal(hauls[0].unloadingStop.geofenceType, 'mixer');
  assert.ok(hauls[0].travelDistanceKm > 10, 'مسافة النقلة يجب أن تكون محسوبة بدقة');
});

test('5. Vehicle Trips Detection for Passenger Cars', () => {
  const baseTime = new Date('2026-11-06T07:00:00Z');
  const pings = [];
  let timeMin = 0;

  // مشوار 1: حركة 20 دقيقة
  for (let i = 0; i < 20; i++) {
    pings.push({
      vehicleId: 'CAR-01',
      latitude: 31.2000 + (i * 0.002),
      longitude: 29.9000 + (i * 0.002),
      speed: 50,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeMin++) * 60000).toISOString()
    });
  }

  // توقف 10 دقائق (وقفة معتمدة)
  for (let i = 0; i < 10; i++) {
    pings.push({
      vehicleId: 'CAR-01',
      latitude: 31.2400,
      longitude: 29.9400,
      speed: 0,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeMin++) * 60000).toISOString()
    });
  }

  // مشوار 2: حركة 15 دقيقة
  for (let i = 0; i < 15; i++) {
    pings.push({
      vehicleId: 'CAR-01',
      latitude: 31.2400 + (i * 0.003),
      longitude: 29.9400 + (i * 0.003),
      speed: 60,
      valid: true,
      timestamp: new Date(baseTime.getTime() + (timeMin++) * 60000).toISOString()
    });
  }

  const cleaned = cleanAndFilterGpsPoints(pings);
  const stops = detectStops(cleaned, [], 'CAR-01');
  const trips = detectVehicleTrips(cleaned, stops, [], 'CAR-01');

  assert.ok(trips.length >= 2, `عدد المشاوير المرصودة ${trips.length} يجب ألا يقل عن 2`);
  assert.ok(trips[0].distanceKm > 0);
  assert.ok(trips[0].maxSpeedKmH >= 50);
});

test('6. Vehicle Live GPS Status & Automated Issues', () => {
  const now = new Date('2026-11-06T14:00:00Z');

  // عربية متصلة وفي حركة
  const movingStatus = evaluateVehicleGpsStatus('CAR-99', [
    {
      vehicleId: 'CAR-99',
      latitude: 31.2,
      longitude: 29.9,
      speed: 45,
      ignition: true,
      valid: true,
      timestamp: new Date(now.getTime() - 2 * 60000).toISOString()
    }
  ], now);
  assert.equal(movingStatus.status, 'moving');
  assert.equal(movingStatus.hasActiveIssue, false);

  // عربية منقطعة منذ 90 دقيقة (> 60 دقيقة)
  const offlineStatus = evaluateVehicleGpsStatus('CAR-88', [
    {
      vehicleId: 'CAR-88',
      latitude: 31.2,
      longitude: 29.9,
      speed: 0,
      ignition: false,
      valid: true,
      timestamp: new Date(now.getTime() - 90 * 60000).toISOString()
    }
  ], now);
  assert.equal(offlineStatus.status, 'offline');
  assert.equal(offlineStatus.hasActiveIssue, true);
  assert.equal(offlineStatus.issueType, 'offline');

  // عربية ذات إشارة متجمدة (Frozen Signal)
  const frozenPings = [];
  for (let i = 0; i < 10; i++) {
    frozenPings.push({
      vehicleId: 'CAR-77',
      latitude: 31.20000,
      longitude: 29.90000,
      speed: 40, // تدعي سرعة لكن الإحداثي لا يتغير إطلاقاً
      ignition: true,
      valid: true,
      timestamp: new Date(now.getTime() - (25 - i * 2) * 60000).toISOString()
    });
  }
  const frozenStatus = evaluateVehicleGpsStatus('CAR-77', frozenPings, now);
  assert.equal(frozenStatus.status, 'frozen_signal');
  assert.equal(frozenStatus.hasActiveIssue, true);
  assert.equal(frozenStatus.issueType, 'frozen_signal');
});

test('7. Full Daily Pipeline & 6 AM Operational Date Cutoff', () => {
  // فحص بداية يوم التشغيل الساعة 6 صباحاً
  // الساعة 5:30 فجر يوم 6 نوفمبر تتبع تشغيلياً يوم 5 نوفمبر (اليوم السابق)
  const earlyMorning = new Date('2026-11-06T05:30:00');
  assert.equal(getOperationalDateString(earlyMorning, 6), '2026-11-05');

  // الساعة 7:00 صباح يوم 6 نوفمبر تتبع يوم 6 نوفمبر
  const normalDay = new Date('2026-11-06T07:00:00');
  assert.equal(getOperationalDateString(normalDay, 6), '2026-11-06');

  // اختبار التحليل اليومي الشامل لعربية جرار
  const result = analyzeVehicleDailyData(
    { id: 'TRACTOR-01', type: 'tractor' },
    [
      {
        vehicleId: 'TRACTOR-01',
        latitude: 31.1000,
        longitude: 29.8000,
        speed: 0,
        valid: true,
        timestamp: '2026-11-06T07:00:00Z'
      },
      {
        vehicleId: 'TRACTOR-01',
        latitude: 31.1200,
        longitude: 29.8200,
        speed: 50,
        valid: true,
        timestamp: '2026-11-06T07:30:00Z'
      }
    ],
    [],
    '2026-11-06'
  );

  assert.equal(result.vehicleId, 'TRACTOR-01');
  assert.equal(result.vehicleType, 'tractor');
  assert.equal(result.operationalDate, '2026-11-06');
  assert.ok(result.totalDistanceKm > 0);
  assert.ok(result.maxSpeedKmH >= 50);
  assert.equal(result.metadata.rulesVersion, DEFAULT_ANALYSIS_CONFIG.rulesVersion);
});
