import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVehiclesFromExcelPaste } from '../dist/index.js';

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