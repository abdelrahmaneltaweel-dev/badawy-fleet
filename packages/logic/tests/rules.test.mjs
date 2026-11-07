import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Firestore Security Rules Matrix & Safety Checks (T3.2)', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidate1 = path.resolve(__dirname, '../../../firebase/firestore.rules');
  const candidate2 = path.resolve(process.cwd(), 'firebase/firestore.rules');
  const candidate3 = path.resolve(process.cwd(), '../../firebase/firestore.rules');
  const rulesPath = fs.existsSync(candidate1) ? candidate1 : (fs.existsSync(candidate2) ? candidate2 : candidate3);
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('should have firestore.rules file existing and using version 2', () => {
    assert.ok(rulesContent.includes("rules_version = '2';"));
    assert.ok(rulesContent.includes('service cloud.firestore'));
  });

  it('should enforce default deny all on root documents', () => {
    assert.ok(rulesContent.includes('match /{document=**} {'));
    assert.ok(rulesContent.includes('allow read, write: if false;'));
  });

  it('should enforce zero-read Auth Custom Claims (Spike S-6 / ADR-013)', () => {
    assert.ok(rulesContent.includes('request.auth.token.role == role'));
    // Ensure no get() is used to read user roles to prevent quota drain
    assert.equal(rulesContent.includes('get(/databases'), false);
  });

  it('should guard period snapshots against modification once frozen (ADR-036)', () => {
    assert.ok(rulesContent.includes('match /period_snapshots/{periodId}'));
    assert.ok(rulesContent.includes('!resource.data.frozen'));
    assert.ok(rulesContent.includes('allow delete: if false;'));
  });

  it('should enforce append-only on audit logs (ADR-018)', () => {
    assert.ok(rulesContent.includes('match /audit_logs/{logId}'));
    assert.ok(rulesContent.includes('allow update, delete: if false;'));
  });

  it('should protect settings write for Super Admin only (ADR-040)', () => {
    assert.ok(rulesContent.includes('match /settings/{settingId}'));
    assert.ok(rulesContent.includes('allow write: if isSuperAdmin();'));
  });

  it('should restrict driver profile reading so drivers cannot inspect others (ADR-013)', () => {
    assert.ok(rulesContent.includes('match /drivers/{driverId}'));
    assert.ok(rulesContent.includes('isDriver() && isUser(driverId)'));
  });

  it('should protect daily snapshots for operational staff and super admin write (T5.6 / ADR-004)', () => {
    assert.ok(rulesContent.includes('match /daily_snapshots/{snapshotId}'));
    assert.ok(rulesContent.includes('allow write: if isSuperAdmin();'));
  });

  it('should protect statements with field-level immutability on source and enteredBy (ADR-018)', () => {
    assert.ok(rulesContent.includes('request.resource.data.enteredBy == resource.data.enteredBy'));
    assert.ok(rulesContent.includes('request.resource.data.source == resource.data.source'));
  });

  it('should restrict GPS issues read so drivers only see their assigned issues (ADR-019)', () => {
    assert.ok(rulesContent.includes('match /issues/{issueId}'));
    assert.ok(rulesContent.includes('resource.data.driverId == request.auth.uid'));
  });
});