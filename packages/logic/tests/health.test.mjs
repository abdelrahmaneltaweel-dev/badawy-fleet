import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSyncHealth } from '../dist/index.js';

test('T5.4.1: Sync Health Evaluation - Null/Unknown State', () => {
  const res = evaluateSyncHealth(null);
  assert.equal(res.status, 'unknown');
  assert.equal(res.isStale, true);
  assert.ok(res.labelArabic.includes('لم يبدأ'));
});

test('T5.4.2: Sync Health Evaluation - Healthy Fresh Run', () => {
  const refNow = '2026-11-06T12:05:00Z';
  const syncState = {
    schemaVersion: 1,
    lastSyncTime: '2026-11-06T12:00:00Z',
    lastRunAt: '2026-11-06T12:02:00Z', // 3 minutes ago
    operationalDate: '2026-11-06',
    rulesVersion: '1.0.0',
    vehicleChecksums: {},
    stats: {
      lastDurationMs: 1200,
      vehiclesTotal: 65,
      writesExecuted: 3,
      writesSkipped: 62,
      errorsCount: 0
    },
    health: 'healthy'
  };

  const res = evaluateSyncHealth(syncState, 15, refNow);
  assert.equal(res.status, 'healthy');
  assert.equal(res.minutesSinceLastRun, 3);
  assert.equal(res.isStale, false);
  assert.ok(res.labelArabic.includes('متزامن'));
  assert.ok(res.detailArabic.includes('65 عربية'));
});

test('T5.4.3: Sync Health Evaluation - Degraded Run (Delayed Runner)', () => {
  const refNow = '2026-11-06T12:28:00Z'; // 26 minutes since last run (interval = 15, threshold = 23)
  const syncState = {
    schemaVersion: 1,
    lastSyncTime: '2026-11-06T12:00:00Z',
    lastRunAt: '2026-11-06T12:02:00Z',
    operationalDate: '2026-11-06',
    rulesVersion: '1.0.0',
    vehicleChecksums: {},
    stats: {
      lastDurationMs: 1400,
      vehiclesTotal: 65,
      writesExecuted: 2,
      writesSkipped: 63,
      errorsCount: 0
    },
    health: 'healthy'
  };

  const res = evaluateSyncHealth(syncState, 15, refNow);
  assert.equal(res.status, 'degraded');
  assert.equal(res.isStale, true);
  assert.ok(res.labelArabic.includes('متأخر'));
});

test('T5.4.4: Sync Health Evaluation - Error Run (Worker Failure or Severe Lag)', () => {
  const refNow = '2026-11-06T13:30:00Z'; // 88 minutes since last run (> 45 min error threshold)
  const syncState = {
    schemaVersion: 1,
    lastSyncTime: '2026-11-06T12:00:00Z',
    lastRunAt: '2026-11-06T12:02:00Z',
    operationalDate: '2026-11-06',
    rulesVersion: '1.0.0',
    vehicleChecksums: {},
    stats: {
      lastDurationMs: 0,
      vehiclesTotal: 65,
      writesExecuted: 0,
      writesSkipped: 0,
      errorsCount: 1
    },
    health: 'healthy'
  };

  const res = evaluateSyncHealth(syncState, 15, refNow);
  assert.equal(res.status, 'error');
  assert.equal(res.isStale, true);
  assert.ok(res.labelArabic.includes('متوقف'));

  // Test explicit error status
  const errorSyncState = {
    ...syncState,
    health: 'error',
    errorMessage: 'فشل الاتصال بسيرفر Traccar'
  };
  const resExplicit = evaluateSyncHealth(errorSyncState, 15, '2026-11-06T12:05:00Z');
  assert.equal(resExplicit.status, 'error');
  assert.ok(resExplicit.detailArabic.includes('Traccar'));
});
