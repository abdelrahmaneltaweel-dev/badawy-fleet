/**
 * Badawi Fleet Platform — Baseline Verification Tests (T4.3)
 * Node.js Native Test Runner (Zero Network, 100% Pure Functions)
 * 
 * المرجع: docs/PROJECT_FRAMEWORK.md (T4.3), Project Status.html (Section 22)
 * معيار القبول: مطابقة أرقام النقلات للنظام القديم بنسبة 100%
 * (116 = 19, 118 = 29, 124 = 29, 114 = 20, 132 = 14, 123 = 13)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeVehicleDailyData,
  cleanAndFilterGpsPoints,
  detectStops,
  detectHaulCycles
} from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// قراءة بيانات التحقق الثابتة من fixtures
const fixturesPath = path.join(__dirname, 'fixtures', 'verification-baseline.json');
const fixtureData = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const { geofences, benchmarks } = fixtureData;

test('T4.3: Vehicle 116 — Baseline Verification (19 Hauls + Mixer Roadside Pass Filter)', () => {
  const b116 = benchmarks['116'];
  assert.ok(b116, 'يجب وجود بيانات عربية 116 في fixtures');

  const result = analyzeVehicleDailyData(
    { id: '116', type: 'tractor' },
    b116.rawPoints,
    geofences,
    '2026-10-18',
    undefined,
    b116.config
  );

  // 1. فحص مطابقة عدد النقلات 100% (19 نقلة)
  assert.strictEqual(
    result.hauls.length,
    19,
    `عربية 116 يجب أن تسجل بالضبط 19 نقلة مطابقة للنظام القديم، المسجل: ${result.hauls.length}`
  );

  // 2. فحص أن كل نقلة لها بداية في الكسارة ونهاية في موقع تفريغ
  for (const haul of result.hauls) {
    assert.strictEqual(haul.loadingStop.geofenceType, 'crusher');
    assert.strictEqual(haul.unloadingStop.geofenceType, 'dump_site');
    assert.ok(haul.travelDistanceKm > 0);
  }

  // 3. التحقق من تطبيق قاعدة MIXER_PASS_STOP_MIN = 20:
  // الوقفة القصيرة (7 دقائق) على الطريق أمام الخلاطة لم تحتسب كنقلة تفريغ خاطئة
  const mixerHauls = result.hauls.filter(h => h.unloadingStop.geofenceType === 'mixer');
  assert.strictEqual(mixerHauls.length, 0, 'وقفة الطريق 7 دقائق أمام الخلاطة لا يجوز احتسابها كتفريغ');
});

test('T4.3: Vehicle 118 — Baseline Verification (29 Hauls Standard Operation)', () => {
  const b118 = benchmarks['118'];
  assert.ok(b118, 'يجب وجود بيانات عربية 118 في fixtures');

  const result = analyzeVehicleDailyData(
    { id: '118', type: 'tractor' },
    b118.rawPoints,
    geofences,
    '2026-10-18',
    undefined,
    b118.config
  );

  // فحص مطابقة عدد النقلات 100% (29 نقلة)
  assert.strictEqual(
    result.hauls.length,
    29,
    `عربية 118 يجب أن تسجل بالضبط 29 نقلة مطابقة للنظام القديم، المسجل: ${result.hauls.length}`
  );
  assert.strictEqual(result.vehicleId, '118');
  assert.ok(result.totalDistanceKm > 100);
});

test('T4.3: Vehicle 124 — Hard Vehicle Profile with FREEZE_FIX (29 Hauls)', () => {
  const b124 = benchmarks['124'];
  assert.ok(b124, 'يجب وجود بيانات عربية 124 في fixtures');

  // 1. تشغيل التحليل مع تفعيل بروفايل العربيات الصعبة FREEZE_FIX
  const resultWithFix = analyzeVehicleDailyData(
    { id: '124', type: 'tractor' },
    b124.rawPoints,
    geofences,
    '2026-10-18',
    undefined,
    { freezeFix: true }
  );

  assert.strictEqual(
    resultWithFix.hauls.length,
    29,
    `عربية 124 مع FREEZE_FIX يجب أن تسجل بالضبط 29 نقلة مطابقة للقديم، المسجل: ${resultWithFix.hauls.length}`
  );

  // 2. التحقق من دور FREEZE_FIX: بدون تصفير السرعة الوهمية، تتفتت الوقفات ويقل عدد النقلات
  const cleanedWithoutFix = cleanAndFilterGpsPoints(b124.rawPoints, { freezeFix: false });
  const stopsWithoutFix = detectStops(cleanedWithoutFix, geofences, '124', { freezeFix: false });
  const haulsWithoutFix = detectHaulCycles(cleanedWithoutFix, stopsWithoutFix, '124', { freezeFix: false });

  assert.ok(
    haulsWithoutFix.length < 29,
    `بدون FREEZE_FIX تتشوه الوقفات بسبب السرعة الوهمية أثناء الوقوف (تم رصد ${haulsWithoutFix.length} نقلة فقط)`
  );
});

test('T4.3: Vehicles 114, 132, 123 — Additional Verified Fleet Numbers', () => {
  // عربية 114 = 20 نقلة
  const r114 = analyzeVehicleDailyData(
    { id: '114', type: 'tractor' },
    benchmarks['114'].rawPoints,
    geofences,
    '2026-10-18'
  );
  assert.strictEqual(r114.hauls.length, 20, 'عربية 114 يجب أن تسجل 20 نقلة بالضبط');

  // عربية 132 = 14 نقلة
  const r132 = analyzeVehicleDailyData(
    { id: '132', type: 'tractor' },
    benchmarks['132'].rawPoints,
    geofences,
    '2026-10-18'
  );
  assert.strictEqual(r132.hauls.length, 14, 'عربية 132 يجب أن تسجل 14 نقلة بالضبط');

  // عربية 123 = 13 نقلة
  const r123 = analyzeVehicleDailyData(
    { id: '123', type: 'tractor' },
    benchmarks['123'].rawPoints,
    geofences,
    '2026-10-18'
  );
  assert.strictEqual(r123.hauls.length, 13, 'عربية 123 يجب أن تسجل 13 نقلة بالضبط');
});

test('T4.3: Full Benchmark Matrix — 100% Numerical Parity with Section 22 Table', () => {
  const verifiedFleetTable = [
    { vehicleId: '116', expected: 19, config: { mixerPassStopMinutes: 20 } },
    { vehicleId: '118', expected: 29, config: {} },
    { vehicleId: '124', expected: 29, config: { freezeFix: true } },
    { vehicleId: '114', expected: 20, config: {} },
    { vehicleId: '132', expected: 14, config: {} },
    { vehicleId: '123', expected: 13, config: {} }
  ];

  for (const entry of verifiedFleetTable) {
    const vData = benchmarks[entry.vehicleId];
    assert.ok(vData, `بيانات العربية ${entry.vehicleId} يجب أن تتوفر`);

    const result = analyzeVehicleDailyData(
      { id: entry.vehicleId, type: 'tractor' },
      vData.rawPoints,
      geofences,
      '2026-10-18',
      undefined,
      entry.config
    );

    assert.strictEqual(
      result.hauls.length,
      entry.expected,
      `العربية [${entry.vehicleId}] تطابق النتيجة ${entry.expected} بنسبة 100%`
    );
  }
});
