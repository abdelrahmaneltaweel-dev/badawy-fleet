import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVehiclesFromExcelPaste,
  resolveVehicleAssignmentHistory,
  getActiveDriverForVehicle,
  calculateDaysBetween,
  formatAssignmentDurationArabic
} from '../dist/index.js';

test('Bulk Import: Successfully parses clean TSV text from Excel with Arabic types', () => {
  const pasteData = `
رقم العربية\tاسم العربية\tاللوحة\tالنوع\tجهاز الـ GPS\tالموقع
116\tعربية 116\tأ ب ج 4821\tجرار\ttraccar-116\tcrusher-2
118\tعربية 118\tد هـ و 1307\tجرار\ttraccar-118\tmixer-main
124\tعربية 124\tز ح ط 9054\tنقل\ttraccar-124\tgarage
130\tعربية 130\tس ص ع 1234\tملاكي\ttraccar-130\tsohag
  `.trim();

  const res = parseVehiclesFromExcelPaste(pasteData);
  assert.strictEqual(res.totalRows, 4);
  assert.strictEqual(res.validCount, 4);
  assert.strictEqual(res.invalidCount, 0);

  assert.strictEqual(res.candidates[0].vehicleId, '116');
  assert.strictEqual(res.candidates[0].type, 'tractor');
  assert.strictEqual(res.candidates[2].type, 'truck');
  assert.strictEqual(res.candidates[3].type, 'private');
});

test('Bulk Import: Catches duplicate IDs and invalid vehicle types', () => {
  const invalidData = `
116\tعربية 116\tأ ب ج 4821\tجرار\t\t
116\tعربية مكررة\tأ ب ج 4821\tجرار\t\t
118\tعربية 118\tد هـ و 1307\tطيارة_هليكوبتر\t\t
  `.trim();

  const res = parseVehiclesFromExcelPaste(invalidData);
  assert.strictEqual(res.totalRows, 3);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.invalidCount, 2);

  // Duplicate ID error
  assert.ok(res.candidates[1].errors.some((e) => e.includes('مكرر')));
  // Invalid type error
  assert.ok(res.candidates[2].errors.some((e) => e.includes('غير معروف')));
});

test('Bulk Import: Handles empty input gracefully', () => {
  const res = parseVehiclesFromExcelPaste('');
  assert.strictEqual(res.totalRows, 0);
  assert.strictEqual(res.validCount, 0);
  assert.strictEqual(res.summaryError, 'النص المنسوخ فارغ');
});

test('Assignment History (ADR-016): Resolves vehicle assignment timeline with duration and active driver', () => {
  const sampleAssignments = [
    { assignmentId: 'as-old', vehicleId: '116', driverId: 'd-1', startDate: '2026-09-01', endDate: '2026-09-30' },
    { assignmentId: 'as-current', vehicleId: '116', driverId: 'd-2', startDate: '2026-10-01', endDate: null },
    { assignmentId: 'as-other', vehicleId: '118', driverId: 'd-3', startDate: '2026-10-01', endDate: null }
  ];

  const sampleDrivers = [
    { driverId: 'd-1', name: 'أحمد حسين', phone: '01011112222', whatsapp: '01011112222', email: null, active: true },
    { driverId: 'd-2', name: 'محمد إبراهيم علي', phone: '01012345671', whatsapp: '01012345671', email: 'driver116@badawi.com', active: true },
    { driverId: 'd-3', name: 'محمود سعد الدين', phone: '01012345672', whatsapp: null, email: null, active: true }
  ];

  // 1. Active driver lookup
  const activeRes = getActiveDriverForVehicle('116', sampleAssignments, sampleDrivers);
  assert.ok(activeRes);
  assert.strictEqual(activeRes.driver.name, 'محمد إبراهيم علي');
  assert.strictEqual(activeRes.assignment.assignmentId, 'as-current');

  // 2. Full timeline lookup (chronological descending: newest first)
  const history = resolveVehicleAssignmentHistory('116', sampleAssignments, sampleDrivers, '2026-10-28');
  assert.strictEqual(history.length, 2);

  const [current, old] = history;
  assert.strictEqual(current.assignmentId, 'as-current');
  assert.strictEqual(current.driverName, 'محمد إبراهيم علي');
  assert.strictEqual(current.isActive, true);
  assert.strictEqual(current.startDate, '2026-10-01');
  assert.strictEqual(current.endDate, null);
  assert.strictEqual(current.durationDays, 28); // 2026-10-01 to 2026-10-28 inclusive = 28 days
  assert.ok(current.formattedPeriod.includes('حتى الآن'));

  assert.strictEqual(old.assignmentId, 'as-old');
  assert.strictEqual(old.driverName, 'أحمد حسين');
  assert.strictEqual(old.isActive, false);
  assert.strictEqual(old.durationDays, 30); // 2026-09-01 to 2026-09-30 inclusive = 30 days
  assert.ok(old.formattedPeriod.includes('إلى 2026-09-30'));

  // 3. Format duration Arabic helper
  assert.strictEqual(formatAssignmentDurationArabic(1), 'يوم واحد');
  assert.strictEqual(formatAssignmentDurationArabic(2), 'يومان');
  assert.strictEqual(formatAssignmentDurationArabic(5), '5 أيام');
  assert.strictEqual(formatAssignmentDurationArabic(28), '28 يوماً');
});