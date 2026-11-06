import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canActOnBehalf,
  computeDiff,
  buildAuditLogItem,
  filterAuditLogs,
  isAuditExpired,
  validateDocument
} from '../dist/index.js';

test('AuditLog: Super Admin can act on behalf of users, other roles cannot (ADR-018)', () => {
  assert.strictEqual(canActOnBehalf('super_admin'), true);
  assert.strictEqual(canActOnBehalf('management'), false);
  assert.strictEqual(canActOnBehalf('mixer_manager'), false);
  assert.strictEqual(canActOnBehalf('garage_security'), false);
  assert.strictEqual(canActOnBehalf('driver'), false);
});

test('AuditLog: computeDiff accurately detects added, changed, and removed keys', () => {
  const before = {
    vehicleId: '116',
    status: 'idle',
    siteId: 'crusher-2',
    notes: 'قديم'
  };

  const after = {
    vehicleId: '116',
    status: 'online',
    siteId: 'mixer-main',
    extraField: 42
  };

  const diff = computeDiff(before, after);

  assert.deepStrictEqual(diff.status, { before: 'idle', after: 'online' });
  assert.deepStrictEqual(diff.siteId, { before: 'crusher-2', after: 'mixer-main' });
  assert.deepStrictEqual(diff.notes, { before: 'قديم', after: null });
  assert.deepStrictEqual(diff.extraField, { before: null, after: 42 });
  assert.strictEqual(diff.vehicleId, undefined); // Unchanged key is excluded
});

test('AuditLog: buildAuditLogItem enforces enteredBy and onBehalfOf fields (ADR-018)', () => {
  const log = buildAuditLogItem({
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: 'u-driver-116',
    onBehalfOfName: 'محمد إبراهيم (سائق 116)',
    action: 'update',
    collection: 'statements',
    documentId: 'stmt-001',
    before: { tripsCount: 3 },
    after: { tripsCount: 5 }
  });

  assert.strictEqual(log.schemaVersion, 1);
  assert.strictEqual(log.enteredBy, 'u-super-admin');
  assert.strictEqual(log.onBehalfOf, 'u-driver-116');
  assert.strictEqual(log.onBehalfOfName, 'محمد إبراهيم (سائق 116)');
  assert.strictEqual(log.diff.tripsCount.before, 3);
  assert.strictEqual(log.diff.tripsCount.after, 5);
  assert.ok(log.title.includes('بالنيابة عن: محمد إبراهيم'));

  // Test compliance with Firestore schema validator
  const validation = validateDocument('audit_logs', log);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.errors.length, 0);
});

test('AuditLog: filterAuditLogs filters by onBehalfOnly, collection, action, and search query', () => {
  const log1 = buildAuditLogItem({
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    action: 'create',
    collection: 'vehicles',
    documentId: '135'
  });

  const log2 = buildAuditLogItem({
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: 'u-feisal-mixer',
    onBehalfOfName: 'فيصل',
    action: 'update',
    collection: 'statements',
    documentId: 'stmt-99'
  });

  const list = [log1, log2];

  // Filter on-behalf only
  const onBehalfList = filterAuditLogs(list, { onBehalfOnly: true });
  assert.strictEqual(onBehalfList.length, 1);
  assert.strictEqual(onBehalfList[0].documentId, 'stmt-99');

  // Filter by collection
  const vehiclesList = filterAuditLogs(list, { collection: 'vehicles' });
  assert.strictEqual(vehiclesList.length, 1);
  assert.strictEqual(vehiclesList[0].documentId, '135');

  // Search by keyword
  const searchResult = filterAuditLogs(list, { search: 'فيصل' });
  assert.strictEqual(searchResult.length, 1);
  assert.strictEqual(searchResult[0].onBehalfOfName, 'فيصل');
});

test('AuditLog: isAuditExpired verifies 24-month retention threshold (ADR-056)', () => {
  const recentDate = new Date().toISOString();
  const resRecent = isAuditExpired(recentDate, 24);
  assert.strictEqual(resRecent.isExpired, false);

  const oldDate = '2023-01-01T00:00:00Z'; // > 24 months from 2026
  const resOld = isAuditExpired(oldDate, 24);
  assert.strictEqual(resOld.isExpired, true);
  assert.ok(resOld.ageMonths >= 24);
});
