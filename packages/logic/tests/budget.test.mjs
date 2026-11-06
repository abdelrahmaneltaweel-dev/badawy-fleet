import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWriteBudget,
  SPARK_DAILY_WRITE_LIMIT,
  SPARK_WARNING_THRESHOLD_PERCENT,
  SPARK_CRITICAL_THRESHOLD_PERCENT,
  getSettingDefinition,
  validateSettingValue
} from '../dist/index.js';

test('T5.3.1: Spark Write Budget Calculation for Standard Fleet (65 Vehicles)', () => {
  // 60 minutes interval (24 runs/day)
  const b60 = calculateWriteBudget(60, 65);
  assert.equal(b60.runsPerDay, 24);
  assert.equal(b60.worstCaseWritesPerRun, 66);
  assert.equal(b60.worstCaseDailyWrites, 1584);
  assert.equal(b60.worstCasePercentOfQuota, 7.9);
  assert.equal(b60.status, 'safe');
  assert.equal(b60.requiresSuperAdminConfirmation, false);

  // 30 minutes interval (48 runs/day)
  const b30 = calculateWriteBudget(30, 65);
  assert.equal(b30.runsPerDay, 48);
  assert.equal(b30.worstCaseDailyWrites, 3168);
  assert.equal(b30.worstCasePercentOfQuota, 15.8);
  assert.equal(b30.status, 'safe');
  assert.equal(b30.requiresSuperAdminConfirmation, false);

  // 15 minutes default interval (96 runs/day)
  const b15 = calculateWriteBudget(15, 65);
  assert.equal(b15.runsPerDay, 96);
  assert.equal(b15.worstCaseDailyWrites, 6336);
  assert.equal(b15.worstCasePercentOfQuota, 31.7);
  assert.equal(b15.status, 'safe');
  assert.equal(b15.requiresSuperAdminConfirmation, false);

  // 6 minutes interval (240 runs/day) -> Warning (70%-90%)
  const b6 = calculateWriteBudget(6, 65);
  assert.equal(b6.runsPerDay, 240);
  assert.equal(b6.worstCaseDailyWrites, 15840);
  assert.equal(b6.worstCasePercentOfQuota, 79.2);
  assert.equal(b6.status, 'warning');
  assert.equal(b6.requiresSuperAdminConfirmation, false);

  // 5 minutes interval (288 runs/day) -> Critical (> 90%, 19,008 writes)
  const b5 = calculateWriteBudget(5, 65);
  assert.equal(b5.runsPerDay, 288);
  assert.equal(b5.worstCaseDailyWrites, 19008);
  assert.equal(b5.worstCasePercentOfQuota, 95.0);
  assert.equal(b5.status, 'critical');
  assert.equal(b5.requiresSuperAdminConfirmation, true);
  assert.ok(b5.messageArabic.includes('ADR-049'));

  // 1 minute interval (1440 runs/day) -> Exceeded (> 100%, 95,040 writes)
  const b1 = calculateWriteBudget(1, 65);
  assert.equal(b1.runsPerDay, 1440);
  assert.equal(b1.worstCaseDailyWrites, 95040);
  assert.equal(b1.worstCasePercentOfQuota, 475.2);
  assert.equal(b1.status, 'exceeded');
  assert.equal(b1.requiresSuperAdminConfirmation, true);
});

test('T5.3.2: Ingestion Refresh Interval in Central Settings Registry (ADR-040, ADR-049)', () => {
  const def = getSettingDefinition('ingestion.refresh_interval_minutes');
  assert.ok(def, 'Setting ingestion.refresh_interval_minutes must exist in registry');
  assert.equal(def.key, 'ingestion.refresh_interval_minutes');
  assert.equal(def.section, 'ingestion_sync');
  assert.equal(def.type, 'number');
  assert.equal(def.defaultValue, 15);
  assert.equal(def.riskLevel, 'logical');
  assert.equal(def.min, 1);
  assert.equal(def.max, 180);
  assert.equal(def.unit, 'دقيقة');

  // Verify alias lookup
  const aliasDef = getSettingDefinition('ingestion_refresh_interval_minutes');
  assert.ok(aliasDef);
  assert.equal(aliasDef.key, 'ingestion.refresh_interval_minutes');
});

test('T5.3.3: ADR-049 Write Guard Enforcement & Super Admin Confirmation', () => {
  // 1. Safe value (15 minutes) passes without confirmation
  const res15 = validateSettingValue('ingestion.refresh_interval_minutes', 15);
  assert.equal(res15.valid, true);
  assert.ok(res15.budget);
  assert.equal(res15.budget.requiresSuperAdminConfirmation, false);

  // 2. Dangerous value (5 minutes = 95% of quota) without confirmation is rejected
  const res5NoConfirm = validateSettingValue('ingestion.refresh_interval_minutes', 5);
  assert.equal(res5NoConfirm.valid, false);
  assert.equal(res5NoConfirm.requiresSuperAdminConfirmation, true);
  assert.ok(res5NoConfirm.error?.includes('ADR-049'));
  assert.ok(res5NoConfirm.error?.includes('90%'));

  // 3. Dangerous value WITH explicit confirmation is accepted
  const res5WithConfirm = validateSettingValue('ingestion.refresh_interval_minutes', 5, {
    superAdminConfirmed: true
  });
  assert.equal(res5WithConfirm.valid, true);
  assert.ok(res5WithConfirm.budget);
  assert.equal(res5WithConfirm.budget.worstCaseDailyWrites, 19008);

  // 4. Out of bounds values are rejected unconditionally
  const resTooLow = validateSettingValue('ingestion.refresh_interval_minutes', 0);
  assert.equal(resTooLow.valid, false);
  assert.ok(resTooLow.error?.includes('الحد الأدنى'));

  const resTooHigh = validateSettingValue('ingestion.refresh_interval_minutes', 200);
  assert.equal(resTooHigh.valid, false);
  assert.ok(resTooHigh.error?.includes('الحد الأقصى'));
});
