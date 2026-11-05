import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  validateDocument,
  migrateDocument
} from '../dist/index.js';

describe('Firestore Schema & Validation Tests (T3.1)', () => {
  it('should validate a correct vehicle document with schemaVersion: 1', () => {
    const vehicle = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      vehicleId: '116',
      name: 'عربية 116',
      plateNumber: 'أ ب ج 4821',
      type: 'tractor',
      gpsDeviceId: '1001',
      siteId: 'site-alex',
      status: 'online',
      active: true,
      createdAt: '2026-11-05T12:00:00Z',
      updatedAt: '2026-11-05T12:00:00Z'
    };

    const res = validateDocument('vehicles', vehicle);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  it('should reject a vehicle with an invalid vehicle type', () => {
    const invalidVehicle = {
      schemaVersion: 1,
      vehicleId: '999',
      name: 'عربية غير معروفة',
      type: 'helicopter' // Invalid
    };

    const res = validateDocument('vehicles', invalidVehicle);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('type must be tractor, truck, or private')));
  });

  it('should reject documents missing schemaVersion', () => {
    const docWithoutVersion = {
      driverId: 'd-1',
      name: 'سائق تجريبي'
    };

    const res = validateDocument('drivers', docWithoutVersion);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('Missing or invalid schemaVersion')));
  });

  it('should auto-migrate legacy documents lacking schemaVersion to baseline v1', () => {
    const legacyDoc = {
      vehicleId: '118',
      name: 'عربية 118 قديمة'
    };

    const result = migrateDocument('vehicles', legacyDoc);
    assert.equal(result.migrated, true);
    assert.equal(result.doc.schemaVersion, 1);
    assert.ok(result.doc.createdAt);
    assert.ok(result.doc.updatedAt);
  });

  it('should validate daily summaries with trips and stops', () => {
    const summary = {
      schemaVersion: 1,
      summaryId: '2026-10-28_116',
      date: '2026-10-28',
      vehicleId: '116',
      driverId: 'drv-01',
      vehicleType: 'tractor',
      tripsCount: 7,
      trips: [
        { start: '06:15', end: '08:30', origin: 'الخلاطة', destination: 'الساحلي الدولي', durationMinutes: 135 }
      ],
      stopsCount: 2,
      stops: [],
      firstMovement: '06:15',
      lastMovement: '17:40',
      matchingStatus: 'matched',
      rulesVersion: '1.0.0',
      createdAt: '2026-10-28T18:00:00Z',
      updatedAt: '2026-10-28T18:00:00Z'
    };

    const res = validateDocument('daily_summaries', summary);
    assert.equal(res.valid, true);
  });
});