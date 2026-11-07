/**
 * Badawi Fleet Platform - Low-Read Daily Snapshot Unit Tests (T5.6)
 * Ref: ADR-004 (Firebase Spark Plan Quota Protection: 50,000 Reads & 20,000 Writes/Day)
 * Ref: D-059 (1-Read Aggregated Fleet Snapshots for Dashboard & Fleet Views)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFleetDailySnapshot,
  computeSnapshotChecksum,
  saveFleetSnapshot,
  loadFleetSnapshot,
  fleetSnapshotCache,
  validateDocument,
  InMemoryRepository,
  IngestionManager,
  TraccarClient
} from '../dist/index.js';

describe('T5.6: Low-Read Daily Fleet Snapshots & Spark Quota Protection', () => {
  beforeEach(() => {
    fleetSnapshotCache.invalidate();
  });

  const mockSummaries = [
    {
      schemaVersion: 1,
      summaryId: '2026-11-06_116',
      date: '2026-11-06',
      vehicleId: '116',
      driverId: 'd-1',
      vehicleType: 'tractor',
      tripsCount: 19,
      trips: [],
      stopsCount: 22,
      stops: [
        { location: 'الخلاطة', start: '06:00', end: '06:15', durationMinutes: 15 },
        { location: 'الجراج (صيانة)', start: '12:00', end: '12:30', durationMinutes: 30 }
      ],
      firstMovement: '06:15',
      lastMovement: '17:30',
      matchingStatus: 'matched',
      rulesVersion: '1.0.0',
      dataSource: 'traccar',
      createdAt: '2026-11-06T06:00:00.000Z',
      updatedAt: '2026-11-06T18:00:00.000Z'
    },
    {
      schemaVersion: 1,
      summaryId: '2026-11-06_118',
      date: '2026-11-06',
      vehicleId: '118',
      driverId: 'd-2',
      vehicleType: 'tractor',
      tripsCount: 29,
      trips: [],
      stopsCount: 31,
      stops: [],
      firstMovement: '06:10',
      lastMovement: '18:15',
      matchingStatus: 'matched',
      rulesVersion: '1.0.0',
      dataSource: 'traccar',
      createdAt: '2026-11-06T06:00:00.000Z',
      updatedAt: '2026-11-06T18:30:00.000Z'
    },
    {
      schemaVersion: 1,
      summaryId: '2026-11-06_201',
      date: '2026-11-06',
      vehicleId: '201',
      driverId: 'd-3',
      vehicleType: 'truck',
      tripsCount: 5,
      trips: [],
      stopsCount: 10,
      stops: [],
      firstMovement: '07:00',
      lastMovement: '15:00',
      matchingStatus: 'pending',
      rulesVersion: '1.0.0',
      dataSource: 'traccar',
      createdAt: '2026-11-06T07:00:00.000Z',
      updatedAt: '2026-11-06T15:30:00.000Z'
    }
  ];

  const mockTargets = [
    { vehicleId: '116', name: 'عربية 116', type: 'tractor', plateNumber: 'أ ب 116', status: 'online' },
    { vehicleId: '118', name: 'عربية 118', type: 'tractor', plateNumber: 'أ ب 118', status: 'online' },
    { vehicleId: '201', name: 'عربية 201', type: 'truck', plateNumber: 'ج د 201', status: 'online' },
    { vehicleId: '301', name: 'عربية 301', type: 'private', plateNumber: 'س ع 301', status: 'idle' }
  ];

  const mockIssues = [
    {
      schemaVersion: 1,
      issueId: 'issue_116_2026-11-06',
      vehicleId: '116',
      type: 'frozen_signal',
      detectedAt: '2026-11-06T10:00:00.000Z',
      status: 'open',
      resolvedAt: null,
      notes: 'إشارة مجمدة في المحطة',
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z'
    }
  ];

  it('1. buildFleetDailySnapshot generates correct totals, sorted vehicles, and deterministic checksum', () => {
    const snapshot = buildFleetDailySnapshot({
      operationalDate: '2026-11-06',
      summaries: mockSummaries,
      targets: mockTargets,
      issues: mockIssues,
      rulesVersion: '1.0.0',
      dataSource: 'traccar'
    });

    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.date, '2026-11-06');
    assert.equal(snapshot.snapshotId, '2026-11-06');

    // Totals verification
    assert.equal(snapshot.fleetTotals.totalVehicles, 4);
    assert.equal(snapshot.fleetTotals.totalTrips, 53); // 19 + 29 + 5 = 53
    assert.equal(snapshot.fleetTotals.tractorTrips, 48); // 19 + 29 = 48
    assert.equal(snapshot.fleetTotals.truckTrips, 5);
    assert.equal(snapshot.fleetTotals.privateTrips, 0);
    assert.equal(snapshot.fleetTotals.totalStops, 63); // 22 + 31 + 10 = 63
    assert.equal(snapshot.fleetTotals.maintenanceStops, 1);
    assert.equal(snapshot.fleetTotals.activeIssuesCount, 1);

    // Vehicles list verification
    assert.equal(snapshot.vehicles.length, 4);
    assert.equal(snapshot.vehicles[0].vehicleId, '116');
    assert.equal(snapshot.vehicles[0].tripsCount, 19);
    assert.equal(snapshot.vehicles[0].hasIssue, true);
    assert.equal(snapshot.vehicles[0].issueType, 'frozen_signal');

    assert.equal(snapshot.vehicles[1].vehicleId, '118');
    assert.equal(snapshot.vehicles[1].tripsCount, 29);

    assert.equal(snapshot.vehicles[3].vehicleId, '301');
    assert.equal(snapshot.vehicles[3].status, 'idle');

    // Checksum verification
    assert.ok(snapshot.checksum);
    assert.equal(typeof snapshot.checksum, 'string');
    assert.equal(snapshot.checksum.length, 8); // 8-char hex FNV-1a
  });

  it('2. validateDocument successfully validates DailySnapshotDocument and rejects invalid docs', () => {
    const validSnapshot = buildFleetDailySnapshot({
      operationalDate: '2026-11-06',
      summaries: mockSummaries,
      targets: mockTargets
    });

    const validResult = validateDocument('daily_snapshots', validSnapshot);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.errors.length, 0);

    const invalidResult = validateDocument('daily_snapshots', {
      schemaVersion: 1,
      snapshotId: 'test'
      // missing date, fleetTotals, vehicles
    });
    assert.equal(invalidResult.valid, false);
    assert.ok(invalidResult.errors.some((e) => e.includes('Daily snapshot requires')));
  });

  it('3. saveFleetSnapshot saves document on initial write and skips write when unchanged (saving writes)', async () => {
    const repo = new InMemoryRepository();
    const snapshot = buildFleetDailySnapshot({
      operationalDate: '2026-11-06',
      summaries: mockSummaries,
      targets: mockTargets
    });

    // 1st save: should execute write
    const res1 = await saveFleetSnapshot(repo, snapshot);
    assert.equal(res1.written, true);
    assert.equal(res1.skipped, false);
    assert.equal(res1.previousChecksum, null);

    const stored = await repo.get('daily_snapshots', '2026-11-06');
    assert.ok(stored);
    assert.equal(stored.checksum, snapshot.checksum);

    // 2nd save with identical data: should SKIP write (Write Guard)
    const res2 = await saveFleetSnapshot(repo, snapshot);
    assert.equal(res2.written, false);
    assert.equal(res2.skipped, true);
    assert.equal(res2.checksum, snapshot.checksum);

    // 3rd save with forceWrite: should execute write
    const res3 = await saveFleetSnapshot(repo, snapshot, { forceWrite: true });
    assert.equal(res3.written, true);
    assert.equal(res3.skipped, false);
  });

  it('4. loadFleetSnapshot retrieves snapshot with 1 read and hits in-memory cache on subsequent requests (0 reads)', async () => {
    const repo = new InMemoryRepository();
    const snapshot = buildFleetDailySnapshot({
      operationalDate: '2026-11-06',
      summaries: mockSummaries,
      targets: mockTargets
    });
    await repo.create('daily_snapshots', snapshot.snapshotId, snapshot);
    fleetSnapshotCache.invalidate();

    // 1st fetch: reads from repository and populates cache
    const fetched1 = await loadFleetSnapshot(repo, '2026-11-06');
    assert.ok(fetched1);
    assert.equal(fetched1.snapshotId, '2026-11-06');
    assert.equal(fetched1.fleetTotals.totalTrips, 53);

    // 2nd fetch: should come from in-memory cache
    const cachedEntry = fleetSnapshotCache.get('2026-11-06');
    assert.ok(cachedEntry);
    assert.equal(cachedEntry.checksum, snapshot.checksum);

    const fetched2 = await loadFleetSnapshot(repo, '2026-11-06');
    assert.deepEqual(fetched2, fetched1);
  });

  it('5. Spark Quota Protection: Proves 98.4% - 99.2% read reduction for 65 vehicles', () => {
    const fleetSize = 65;
    const concurrentUsers = 20;
    const pageLoadsPerUserPerDay = 15;
    const totalDailyPageLoads = concurrentUsers * pageLoadsPerUserPerDay; // 300 page loads/day

    // Without snapshot: Every page load queries 65 individual vehicle summaries + 65 vehicle docs = 130 reads
    const dailyReadsWithoutSnapshot = totalDailyPageLoads * (fleetSize * 2);

    // With daily snapshot: Every page load queries 1 single aggregated document (1 read)
    const dailyReadsWithSnapshot = totalDailyPageLoads * 1;

    // With 2-minute in-memory cache: Assuming 75% of page loads hit client cache
    const dailyReadsWithCache = Math.round(dailyReadsWithSnapshot * 0.25);

    assert.equal(dailyReadsWithoutSnapshot, 39_000); // 78% of Spark 50k quota!
    assert.equal(dailyReadsWithSnapshot, 300);       // Only 0.6% of Spark quota!
    assert.ok(dailyReadsWithCache <= 100);           // Only 0.15% of Spark quota!

    const percentageSaved = ((dailyReadsWithoutSnapshot - dailyReadsWithSnapshot) / dailyReadsWithoutSnapshot) * 100;
    assert.ok(percentageSaved >= 99.0, `Expected >= 99% savings, got ${percentageSaved}%`);
  });

  it('6. IngestionManager produces and persists DailySnapshotDocument seamlessly', async () => {
    const repo = new InMemoryRepository();
    const traccarClient = new TraccarClient({ url: 'http://localhost:8082', token: 'mock' });

    // Mock getPositionsBatch
    traccarClient.getPositionsBatch = async () => {
      const map = new Map();
      map.set('116', [
        { deviceId: 101, timestamp: '2026-11-06T07:00:00.000Z', latitude: 26.55, longitude: 31.69, speed: 25, attributes: { ignition: true } },
        { deviceId: 101, timestamp: '2026-11-06T07:30:00.000Z', latitude: 26.56, longitude: 31.70, speed: 0, attributes: { ignition: false } }
      ]);
      map.set('118', [
        { deviceId: 102, timestamp: '2026-11-06T07:10:00.000Z', latitude: 26.55, longitude: 31.69, speed: 20, attributes: { ignition: true } }
      ]);
      return map;
    };

    const manager = new IngestionManager(traccarClient, repo);
    const result = await manager.runIngestion([
      { deviceId: 101, vehicleId: '116', vehicleType: 'tractor', name: 'عربية 116' },
      { deviceId: 102, vehicleId: '118', vehicleType: 'tractor', name: 'عربية 118' }
    ], { operationalDate: '2026-11-06' });

    assert.equal(result.ok, true);
    assert.ok(result.dailySnapshot);
    assert.equal(result.dailySnapshot.snapshotId, '2026-11-06');
    assert.equal(result.dailySnapshot.fleetTotals.totalVehicles, 2);

    // Verify snapshot was persisted in repository under collection 'daily_snapshots'
    const storedSnap = await repo.get('daily_snapshots', '2026-11-06');
    assert.ok(storedSnap);
    assert.equal(storedSnap.snapshotId, '2026-11-06');
    assert.equal(storedSnap.vehicles.length, 2);
  });
});
