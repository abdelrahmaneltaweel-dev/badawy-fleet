import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryRepository,
  FirestoreRestRepository,
  GoogleSheetsBackupRepository,
  createRepository,
  switchRepository,
  getActiveRepository
} from '../dist/index.js';

test('Repository: InMemoryRepository CRUD and schemaVersion: 1 validation (ADR-008, ADR-009)', async () => {
  const repo = new InMemoryRepository();

  // 1. Create Vehicle
  const created = await repo.create('vehicles', '116', {
    vehicleId: '116',
    name: 'عربية 116',
    plateNumber: 'أ ب ج 4821',
    type: 'tractor',
    gpsDeviceId: '101',
    siteId: 'crusher-2',
    status: 'online',
    active: true
  });

  assert.strictEqual(created.schemaVersion, 1);
  assert.strictEqual(created.vehicleId, '116');
  assert.ok(created.createdAt);

  // 2. Get Vehicle
  const fetched = await repo.get('vehicles', '116');
  assert.ok(fetched);
  assert.strictEqual(fetched.vehicleId, '116');
  assert.strictEqual(fetched.name, 'عربية 116');

  // 3. Update Vehicle
  const updated = await repo.update('vehicles', '116', {
    status: 'idle',
    siteId: 'mixer-main'
  });
  assert.strictEqual(updated.status, 'idle');
  assert.strictEqual(updated.siteId, 'mixer-main');

  // 4. List with filter
  const all = await repo.list('vehicles', {
    filters: [{ field: 'status', op: '==', value: 'idle' }]
  });
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].vehicleId, '116');

  // 5. Delete Vehicle
  const deleted = await repo.delete('vehicles', '116');
  assert.strictEqual(deleted, true);

  const afterDelete = await repo.get('vehicles', '116');
  assert.strictEqual(afterDelete, null);
});

test('Repository: InMemoryRepository advanced filtering and sorting (ADR-009)', async () => {
  const repo = new InMemoryRepository();

  await repo.create('vehicles', '116', {
    vehicleId: '116',
    name: 'عربية 116',
    plateNumber: 'أ',
    type: 'tractor',
    gpsDeviceId: null,
    siteId: null,
    status: 'online',
    active: true
  });

  await repo.create('vehicles', '118', {
    vehicleId: '118',
    name: 'عربية 118',
    plateNumber: 'ب',
    type: 'truck',
    gpsDeviceId: null,
    siteId: null,
    status: 'idle',
    active: true
  });

  await repo.create('vehicles', '124', {
    vehicleId: '124',
    name: 'عربية 124',
    plateNumber: 'ج',
    type: 'tractor',
    gpsDeviceId: null,
    siteId: null,
    status: 'offline',
    active: false
  });

  // Filter in list
  const tractors = await repo.list('vehicles', {
    filters: [{ field: 'type', op: '==', value: 'tractor' }]
  });
  assert.strictEqual(tractors.length, 2);

  // Sorting descending by vehicleId
  const sorted = await repo.list('vehicles', {
    sort: [{ field: 'vehicleId', direction: 'desc' }]
  });
  assert.strictEqual(sorted[0].vehicleId, '124');
  assert.strictEqual(sorted[1].vehicleId, '118');
  assert.strictEqual(sorted[2].vehicleId, '116');

  // Limit and offset
  const paginated = await repo.list('vehicles', {
    sort: [{ field: 'vehicleId', direction: 'asc' }],
    offset: 1,
    limit: 1
  });
  assert.strictEqual(paginated.length, 1);
  assert.strictEqual(paginated[0].vehicleId, '118');
});

test('Repository: FirestoreRestRepository serialization and deserialization (ADR-004)', () => {
  const repo = new FirestoreRestRepository({ projectId: 'test-badawi-fleet' });

  const jsObject = {
    vehicleId: '116',
    tripsCount: 14,
    fuelConsumption: 124.5,
    active: true,
    notes: null,
    tags: ['crusher', 'ready'],
    metadata: {
      source: 'mixer',
      version: 2
    }
  };

  // Convert to Firestore REST JSON
  const firestoreFields = repo.toFirestoreFields(jsObject);

  assert.deepStrictEqual(firestoreFields.vehicleId, { stringValue: '116' });
  assert.deepStrictEqual(firestoreFields.tripsCount, { integerValue: '14' });
  assert.deepStrictEqual(firestoreFields.fuelConsumption, { doubleValue: 124.5 });
  assert.deepStrictEqual(firestoreFields.active, { booleanValue: true });
  assert.deepStrictEqual(firestoreFields.notes, { nullValue: null });
  assert.deepStrictEqual(firestoreFields.tags, {
    arrayValue: {
      values: [{ stringValue: 'crusher' }, { stringValue: 'ready' }]
    }
  });

  // Convert back to JS Object
  const restored = repo.fromFirestoreDocument({ fields: firestoreFields });

  assert.strictEqual(restored.vehicleId, '116');
  assert.strictEqual(restored.tripsCount, 14);
  assert.strictEqual(restored.fuelConsumption, 124.5);
  assert.strictEqual(restored.active, true);
  assert.strictEqual(restored.notes, null);
  assert.deepStrictEqual(restored.tags, ['crusher', 'ready']);
  assert.strictEqual(restored.metadata.source, 'mixer');
  assert.strictEqual(restored.metadata.version, 2);
});

test('Repository: GoogleSheetsBackupRepository operations (ADR-003, ADR-009)', async () => {
  const sheetsRepo = new GoogleSheetsBackupRepository();

  const created = await sheetsRepo.create('sites', 'crusher-2', {
    siteId: 'crusher-2',
    name: 'الكسارة 2',
    type: 'crusher',
    latitude: 31.025,
    longitude: 29.851,
    radiusMeters: 300,
    active: true
  });

  assert.strictEqual(created.siteId, 'crusher-2');

  const fetched = await sheetsRepo.get('sites', 'crusher-2');
  assert.strictEqual(fetched.name, 'الكسارة 2');

  const allSites = await sheetsRepo.list('sites');
  assert.strictEqual(allSites.length, 1);
});

test('Repository: Single-file store swap switches active repository effortlessly (ADR-009 acceptance criteria)', () => {
  // 1. Initial memory repo
  const repo1 = switchRepository({ provider: 'memory' });
  assert.strictEqual(repo1.name, 'InMemoryRepository');
  assert.strictEqual(getActiveRepository().name, 'InMemoryRepository');

  // 2. Swap to Sheets backup
  const repo2 = switchRepository({ provider: 'sheets' });
  assert.strictEqual(repo2.name, 'GoogleSheetsBackupRepository');
  assert.strictEqual(getActiveRepository().name, 'GoogleSheetsBackupRepository');

  // 3. Swap to Firestore REST
  const repo3 = switchRepository({
    provider: 'firestore',
    projectId: 'badawi-fleet-prod'
  });
  assert.strictEqual(repo3.name, 'FirestoreRestRepository');
  assert.strictEqual(getActiveRepository().name, 'FirestoreRestRepository');

  // 4. Return to Memory
  const repo4 = switchRepository({ provider: 'memory' });
  assert.strictEqual(repo4.name, 'InMemoryRepository');
});
