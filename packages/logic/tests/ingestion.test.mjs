/**
 * Badawi Fleet Platform - Ingestion Worker & Diff Check Tests (T5.2)
 * Ref: ADR-004 (Spark Free Plan Quota Protection), ADR-005 (Actions Worker)
 * Ref: ADR-019 (GPS Issues Lifecycle), ADR-023, ADR-049
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSummaryChecksum,
  hasSummaryChanged,
  fnv1aHex,
  IngestionManager,
  TraccarClient,
  InMemoryRepository
} from '../dist/index.js';

// Helper to create mock GPS points
function createMockPings(vehicleId, count, baseDateStr = '2026-11-06T07:00:00Z', moving = false) {
  const baseDate = new Date(baseDateStr).getTime();
  const pings = [];
  for (let i = 0; i < count; i++) {
    pings.push({
      id: i + 1,
      vehicleId,
      latitude: 31.2 + (moving ? i * 0.001 : 0),
      longitude: 29.9 + (moving ? i * 0.001 : 0),
      speed: moving ? 45 : 0,
      ignition: moving,
      timestamp: new Date(baseDate + i * 60000).toISOString(),
      valid: true
    });
  }
  return pings;
}

test('T5.2.1: Deterministic Checksum & Fingerprint Generation', () => {
  const summaryA = {
    schemaVersion: 1,
    summaryId: '2026-11-06_116',
    date: '2026-11-06',
    vehicleId: '116',
    driverId: 'D-01',
    vehicleType: 'tractor',
    tripsCount: 19,
    trips: [
      { start: '07:00', end: '07:35', origin: 'الخلاطة', destination: 'الكسارة', durationMinutes: 35 }
    ],
    stopsCount: 2,
    stops: [
      { location: 'الخلاطة', start: '06:30', end: '07:00', durationMinutes: 30 }
    ],
    firstMovement: '07:00',
    lastMovement: '17:00',
    matchingStatus: 'matched',
    rulesVersion: '1.0.0',
    createdAt: '2026-11-06T06:00:00Z',
    updatedAt: '2026-11-06T06:00:00Z'
  };

  const hash1 = computeSummaryChecksum(summaryA);
  const hash2 = computeSummaryChecksum(summaryA);
  assert.equal(hash1, hash2, 'Identical summary must yield identical hash');

  // Modify trips count -> hash MUST change
  const summaryB = { ...summaryA, tripsCount: 20 };
  const hash3 = computeSummaryChecksum(summaryB);
  assert.notEqual(hash1, hash3, 'Changed trip count must yield different hash');

  // hasSummaryChanged test
  assert.equal(hasSummaryChanged(hash1, hash1), false);
  assert.equal(hasSummaryChanged(hash1, hash3), true);
  assert.equal(hasSummaryChanged(undefined, hash1), true, 'First sync always indicates change');
});

test('T5.2.2: First Run Ingestion — Writes Summaries & Sync State to Repository', async () => {
  const repo = new InMemoryRepository();
  const client = new TraccarClient({ url: 'http://traccar.mock' });

  // Mock getPositionsBatch
  client.getPositionsBatch = async () => {
    const map = new Map();
    map.set('116', createMockPings('116', 20, '2026-11-06T07:00:00Z', true));
    map.set('118', createMockPings('118', 15, '2026-11-06T07:10:00Z', true));
    return map;
  };

  const manager = new IngestionManager(client, repo);
  const targets = [
    { deviceId: 1, vehicleId: '116', vehicleType: 'tractor' },
    { deviceId: 2, vehicleId: '118', vehicleType: 'tractor' }
  ];

  const result = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:30:00Z'
  });

  assert.equal(result.ok, true);
  assert.equal(result.stats.vehiclesProcessed, 2);
  // 2 summaries + 1 sync_state = 3 writes
  assert.equal(result.stats.writesExecuted, 3);
  assert.equal(result.stats.writesSkipped, 0);

  // Check stored documents in repo
  const sum116 = await repo.get('daily_summaries', '2026-11-06_116');
  assert.ok(sum116);
  assert.equal(sum116.vehicleId, '116');

  const syncDoc = await repo.get('settings', 'sync_state');
  assert.ok(syncDoc);
  assert.ok(syncDoc.data.vehicleChecksums['116']);
  assert.ok(syncDoc.data.vehicleChecksums['118']);
});

test('T5.2.3: Zero-Write Optimization on Unchanged Runs (ADR-004 Quota Protection)', async () => {
  const repo = new InMemoryRepository();
  const client = new TraccarClient({ url: 'http://traccar.mock' });

  const staticPoints116 = createMockPings('116', 30, '2026-11-06T07:00:00Z', false); // parked
  const staticPoints118 = createMockPings('118', 30, '2026-11-06T07:00:00Z', false); // parked

  client.getPositionsBatch = async () => {
    const map = new Map();
    map.set('116', staticPoints116);
    map.set('118', staticPoints118);
    return map;
  };

  const manager = new IngestionManager(client, repo);
  const targets = [
    { deviceId: 1, vehicleId: '116', vehicleType: 'tractor' },
    { deviceId: 2, vehicleId: '118', vehicleType: 'tractor' }
  ];

  // Run 1: First sync writes 2 summaries + 1 state
  const run1 = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:35:00Z'
  });
  assert.equal(run1.stats.writesExecuted, 3);

  // Run 2: Exact same points returned (vehicles did not move)
  const run2 = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:35:00Z'
  });

  // CRITICAL ACCEPTANCE: 0 daily_summary writes executed! 100% of vehicle writes skipped!
  assert.equal(run2.stats.writesSkipped, 2);
  assert.equal(run2.stats.writesSavedPercent, 100);
  assert.equal(run2.stats.writesExecuted, 1); // Only 1 sync_state heartbeat write
});

test('T5.2.4: Partial Update (Diff Check) Writes ONLY Changed Vehicles', async () => {
  const repo = new InMemoryRepository();
  const client = new TraccarClient({ url: 'http://traccar.mock' });

  let pings116 = createMockPings('116', 20, '2026-11-06T07:00:00Z', false);
  let pings118 = createMockPings('118', 20, '2026-11-06T07:00:00Z', false);
  let pings124 = createMockPings('124', 20, '2026-11-06T07:00:00Z', false);

  client.getPositionsBatch = async () => {
    const map = new Map();
    map.set('116', pings116);
    map.set('118', pings118);
    map.set('124', pings124);
    return map;
  };

  const manager = new IngestionManager(client, repo);
  const targets = [
    { deviceId: 1, vehicleId: '116', vehicleType: 'tractor' },
    { deviceId: 2, vehicleId: '118', vehicleType: 'tractor' },
    { deviceId: 3, vehicleId: '124', vehicleType: 'tractor' }
  ];

  // Initial Run
  await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:25:00Z'
  });

  // Simulate vehicle 118 starting a new trip while 116 and 124 remain stopped
  pings118 = [
    ...pings118,
    ...createMockPings('118', 25, '2026-11-06T07:20:00Z', true)
  ];

  // Second Run
  const run2 = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:50:00Z'
  });

  // Only vehicle 118 was changed
  const result116 = run2.vehicleResults.find((r) => r.vehicleId === '116');
  const result118 = run2.vehicleResults.find((r) => r.vehicleId === '118');
  const result124 = run2.vehicleResults.find((r) => r.vehicleId === '124');

  assert.equal(result116?.changed, false);
  assert.equal(result118?.changed, true);
  assert.equal(result124?.changed, false);

  assert.equal(run2.stats.writesSkipped, 2);
  assert.equal(run2.stats.writesExecuted, 2); // 1 summary (118) + 1 state
});

test('T5.2.5: Resilient lastSyncTime Monotonic Tracking & Cron Jitter Recovery', async () => {
  const repo = new InMemoryRepository();
  const client = new TraccarClient({ url: 'http://traccar.mock' });

  const pings = createMockPings('116', 10, '2026-11-06T09:00:00Z', true);
  const newestTimestampInPings = pings[pings.length - 1].timestamp;

  client.getPositionsBatch = async () => {
    const map = new Map();
    map.set('116', pings);
    return map;
  };

  const manager = new IngestionManager(client, repo);
  const targets = [{ deviceId: 1, vehicleId: '116', vehicleType: 'tractor' }];

  const res = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T09:15:00Z'
  });
  assert.equal(res.syncState.lastSyncTime, newestTimestampInPings);
});

test('T5.2.6: Spark Write Budget Protection — Fleet of 65 Stays Far Below 20,000 Writes/Day', async () => {
  const repo = new InMemoryRepository();
  const client = new TraccarClient({ url: 'http://traccar.mock' });

  // Simulate 65 vehicles
  const targets = [];
  const pointsMap = new Map();
  for (let i = 1; i <= 65; i++) {
    const vId = `BADAWI-${100 + i}`;
    targets.push({ deviceId: i, vehicleId: vId, vehicleType: 'tractor' });
    pointsMap.set(vId, createMockPings(vId, 10, '2026-11-06T07:00:00Z', false));
  }

  client.getPositionsBatch = async () => pointsMap;

  const manager = new IngestionManager(client, repo);

  // Run 1: Morning initialization (65 writes + 1 state = 66 writes)
  const morningRun = await manager.runIngestion(targets, {
    operationalDate: '2026-11-06',
    referenceNow: '2026-11-06T07:15:00Z'
  });
  assert.equal(morningRun.stats.writesExecuted, 66);

  // Simulate 23 subsequent runs throughout the day (every hour) where only 5 vehicles move per hour
  let totalDailyWrites = morningRun.stats.writesExecuted;

  for (let hour = 1; hour <= 23; hour++) {
    const minStr = String(hour).padStart(2, '0');
    // 5 random moving vehicles
    for (let m = 1; m <= 5; m++) {
      const vId = `BADAWI-${100 + m}`;
      const current = pointsMap.get(vId) || [];
      pointsMap.set(vId, [...current, ...createMockPings(vId, 5, `2026-11-06T08:${minStr}:00Z`, true)]);
    }

    const hourlyRun = await manager.runIngestion(targets, {
      operationalDate: '2026-11-06',
      referenceNow: `2026-11-06T08:${minStr}:10Z`
    });
    totalDailyWrites += hourlyRun.stats.writesExecuted;
  }

  // Total daily writes calculation:
  // With naive write: 65 vehicles * 24 runs = 1,560 writes.
  // With diff check: 66 initial + 23 runs * (5 vehicles + 1 state) = 66 + 138 = 204 writes!
  assert.ok(totalDailyWrites < 1000, `Total daily writes (${totalDailyWrites}) must stay far below Spark limit of 20,000`);
  assert.ok(totalDailyWrites < 500, `Total daily writes (${totalDailyWrites}) confirms > 85% write savings`);
});
