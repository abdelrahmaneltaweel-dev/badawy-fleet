/**
 * Badawi Fleet Platform - T4.5 Calculated Columns & Pricing Tests
 * Ref: ADR-057 (الأعمدة المحسوبة وترجمة صيغ Sheets البسيطة / Calculated Columns & Safe Parser)
 * Ref: D-051 (الأسعار التقديرية والنهائية بتواريخ سريان / Effective-Dated Pricing)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  parse,
  evaluateFormula,
  compileFormula,
  evaluateColumn,
  lookupPrice,
  createDefaultPriceTable,
  validatePriceTable,
  translateSheetsFormula
} from '../dist/index.js';

test('T4.5.1: Lexer & Safe Parser — Math Operations & Operator Precedence', () => {
  // 1. Basic Arithmetic
  const r1 = evaluateFormula('10 + 5 * 2', { row: {} });
  assert.equal(r1.success, true);
  assert.equal(r1.value, 20); // Precedence: 5*2 first, then + 10

  // 2. Parentheses override precedence
  const r2 = evaluateFormula('(10 + 5) * 2', { row: {} });
  assert.equal(r2.success, true);
  assert.equal(r2.value, 30);

  // 3. Power, division, modulo, and Arabic symbols (×, ÷)
  const r3 = evaluateFormula('2 ^ 3 + 10 ÷ 2 - 4 × 2', { row: {} });
  assert.equal(r3.success, true);
  assert.equal(r3.value, 5); // 8 + 5 - 8 = 5

  // 4. Safe division by zero (ADR-057: yields 0, no crash)
  const r4 = evaluateFormula('100 / 0', { row: {} });
  assert.equal(r4.success, true);
  assert.equal(r4.value, 0);

  // 5. Unary minus and nested parentheses
  const r5 = evaluateFormula('-(5 + 3) * 2', { row: {} });
  assert.equal(r5.success, true);
  assert.equal(r5.value, -16);
});

test('T4.5.2: Column Identifiers & Arabic Bracketed Names', () => {
  const row = {
    hauls: 19,
    rate_per_haul: 160,
    allowance: 50,
    'خصم': 20,
    'حافز إضافي': 100
  };

  // English bracketed and non-bracketed
  const r1 = evaluateFormula('[hauls] * [rate_per_haul] + [allowance]', { row });
  assert.equal(r1.success, true);
  assert.equal(r1.value, 19 * 160 + 50); // 3090

  // Arabic bracketed column names (ADR-057)
  const r2 = evaluateFormula('[hauls] * 160 + [حافز إضافي] - [خصم]', { row });
  assert.equal(r2.success, true);
  assert.equal(r2.value, 19 * 160 + 100 - 20); // 3120

  // Case-insensitive & canonical alias resolution
  const r3 = evaluateFormula('نقلات * أجر', { row: { hauls: 25, rate: 150 } });
  assert.equal(r3.success, true);
  assert.equal(r3.value, 3750);
});

test('T4.5.3: Conditional IF & Built-in Functions with Lazy Evaluation', () => {
  const row = {
    hauls: 22,
    threshold: 20,
    bonus_rate: 180,
    base_rate: 160
  };

  // IF: condition ? true_val : false_val
  const r1 = evaluateFormula('IF(hauls >= threshold, hauls * bonus_rate, hauls * base_rate)', { row });
  assert.equal(r1.success, true);
  assert.equal(r1.value, 22 * 180); // 3960

  // Lazy evaluation: The unreached branch is not evaluated
  let unreachedCalled = false;
  const ctxWithFn = {
    row: {},
    customFunctions: {
      CRASH_IF_CALLED: () => {
        unreachedCalled = true;
        throw new Error('Should not have been evaluated!');
      }
    }
  };
  const r2 = evaluateFormula('IF(10 > 5, 42, CRASH_IF_CALLED())', ctxWithFn);
  assert.equal(r2.success, true);
  assert.equal(r2.value, 42);
  assert.equal(unreachedCalled, false);

  // ROUND, MIN, MAX, ABS, COALESCE
  const r3 = evaluateFormula('ROUND(125.4567, 2)', { row: {} });
  assert.equal(r3.value, 125.46);

  const r4 = evaluateFormula('MIN(10, 5, 20, 2)', { row: {} });
  assert.equal(r4.value, 2);

  const r5 = evaluateFormula('MAX(10, 5, 20, 2)', { row: {} });
  assert.equal(r5.value, 20);

  const r6 = evaluateFormula('ABS(-150)', { row: {} });
  assert.equal(r6.value, 150);

  const r7 = evaluateFormula('COALESCE(null, "", 0, 999)', { row: {} });
  assert.equal(r7.value, 0);
});

test('T4.5.4: Effective-Dated Pricing Engine (D-051, ADR-057)', () => {
  const priceTable = {
    version: 2,
    entries: [
      {
        id: 'tractor_early_2026',
        category: 'tractor',
        rate: 150,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-05-31',
        description: 'سعر نقلة الجرار في النصف الأول من 2026'
      },
      {
        id: 'tractor_late_2026',
        category: 'tractor',
        rate: 165,
        effectiveFrom: '2026-06-01',
        effectiveTo: '2026-12-31',
        description: 'سعر نقلة الجرار في النصف الثاني من 2026 بعد الزيادة'
      },
      {
        id: 'tractor_special_route',
        category: 'tractor',
        itemKey: 'site_sinai',
        rate: 220,
        effectiveFrom: '2026-01-01',
        description: 'سعر خاص لموقع سيناء'
      }
    ]
  };

  // 1. Validation check
  const valResult = validatePriceTable(priceTable);
  assert.equal(valResult.valid, true);

  // 2. Early period lookup preserves historical price (150 EGP)
  const priceEarly = lookupPrice(priceTable, 'tractor', '2026-03-15');
  assert.equal(priceEarly, 150);

  // 3. Late period lookup retrieves increased price (165 EGP)
  const priceLate = lookupPrice(priceTable, 'tractor', '2026-08-10');
  assert.equal(priceLate, 165);

  // 4. Specific itemKey priority over generic category
  const priceSpecial = lookupPrice(priceTable, 'tractor', '2026-03-15', 'site_sinai');
  assert.equal(priceSpecial, 220);

  // 5. In-formula PRICE function call
  const rowEarly = { hauls: 19 };
  const rFormulaEarly = evaluateFormula('[hauls] * PRICE("tractor")', {
    row: rowEarly,
    priceTable,
    date: '2026-03-15'
  });
  assert.equal(rFormulaEarly.value, 19 * 150); // 2850

  const rowLate = { hauls: 19 };
  const rFormulaLate = evaluateFormula('[hauls] * PRICE("tractor")', {
    row: rowLate,
    priceTable,
    date: '2026-08-10'
  });
  assert.equal(rFormulaLate.value, 19 * 165); // 3135
});

test('T4.5.5: Google Sheets Formula Translation (D-057, ADR-057)', () => {
  const colMap = {
    A: 'hauls',
    B: 'rate',
    C: 'bonus',
    D: 'total'
  };

  // 1. Valid in-row multiplication
  const t1 = translateSheetsFormula('=A2*B2', 2, colMap);
  assert.equal(t1.isSupported, true);
  assert.equal(t1.translatedFormula, '[hauls]*[rate]');
  assert.equal(evaluateFormula(t1.translatedFormula, { row: { hauls: 19, rate: 160 } }).value, 3040);

  // 2. In-row conditional IF formula with European/Arabic semicolon
  const t2 = translateSheetsFormula('=IF(A5>10; A5*B5; 0)', 5, colMap);
  assert.equal(t2.isSupported, true);
  assert.equal(t2.translatedFormula, 'IF([hauls]>10, [hauls]*[rate], 0)');
  assert.equal(evaluateFormula(t2.translatedFormula, { row: { hauls: 15, rate: 160 } }).value, 2400);
  assert.equal(evaluateFormula(t2.translatedFormula, { row: { hauls: 5, rate: 160 } }).value, 0);

  // 3. In-row ROUND formula
  const t3 = translateSheetsFormula('=ROUND(A12*B12; 2)', 12, colMap);
  assert.equal(t3.isSupported, true);
  assert.equal(t3.translatedFormula, 'ROUND([hauls]*[rate], 2)');
  assert.equal(evaluateFormula(t3.translatedFormula, { row: { hauls: 10.555, rate: 2 } }).value, 21.11);

  // 4. Safely reject cross-row formula (ADR-057)
  const t4 = translateSheetsFormula('=A1*B2', 2, colMap); // Row 1 != Row 2
  assert.equal(t4.isSupported, false);
  assert.match(t4.reason || '', /other than row 2/);

  // 5. Safely reject cross-sheet formula (ADR-057)
  const t5 = translateSheetsFormula('=Sheet2!A2*B2', 2, colMap);
  assert.equal(t5.isSupported, false);
  assert.match(t5.reason || '', /Cross-sheet formulas are not supported/);

  // 6. Safely reject multi-row ranges (ADR-057)
  const t6 = translateSheetsFormula('=SUM(A1:A10)', 10, colMap);
  assert.equal(t6.isSupported, false);
  assert.match(t6.reason || '', /multiple rows/);
});

test('T4.5.6: Batch Column Evaluation & Pre-compilation Speed', () => {
  const rows = [
    { vehicleId: '116', hauls: 19, rate: 160 },
    { vehicleId: '118', hauls: 29, rate: 160 },
    { vehicleId: '124', hauls: 29, rate: 160 },
    { vehicleId: '114', hauls: 20, rate: 160 }
  ];

  const results = evaluateColumn('[hauls] * [rate]', rows);
  assert.deepEqual(results, [
    19 * 160, // 3040
    29 * 160, // 4640
    29 * 160, // 4640
    20 * 160  // 3200
  ]);

  // Pre-compiled formula works identically
  const compiled = compileFormula('[hauls] * [rate]');
  assert.equal(compiled({ row: rows[0] }), 3040);
  assert.equal(compiled({ row: rows[1] }), 4640);
});

test('T4.5.7: Security & Sandbox Hardening (No Code Execution)', () => {
  // Malicious / illegal JavaScript constructs must fail syntax parsing
  assert.equal(evaluateFormula('process.exit(1)', { row: {} }).success, false);
  assert.equal(evaluateFormula('globalThis', { row: {} }).value, 0); // Treated as identifier returning 0
  assert.equal(evaluateFormula('function() {}', { row: {} }).success, false);
  assert.equal(evaluateFormula('import("fs")', { row: {} }).success, false);
  assert.equal(evaluateFormula('eval("2+2")', { row: {} }).success, false); // No eval function exists
});
