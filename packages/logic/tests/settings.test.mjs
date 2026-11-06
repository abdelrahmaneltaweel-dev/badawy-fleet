import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_SETTINGS_REGISTRY,
  getDefaultSettings,
  calculateWriteQuotaImpact,
  SettingsManager
} from '../dist/index.js';

describe('Settings Registry & Protection Limits (T3.4 / ADR-040, ADR-044)', () => {
  it('should have all registry entries configured with default values and categories', () => {
    assert.ok(SYSTEM_SETTINGS_REGISTRY.length >= 10);
    const defaults = getDefaultSettings();
    assert.equal(defaults['rules.trip.minStopMinutes'], 20);
    assert.equal(defaults['rules.trip.siteRadiusMeters'], 250);
    assert.equal(defaults['rules.dayStartHour'], 6);
    assert.equal(defaults['petro.reorderThreshold'], 25000);
  });

  it('should calculate accurate Spark write quota impacts (ADR-049)', () => {
    const impact10m = calculateWriteQuotaImpact(10, 65);
    assert.equal(impact10m.dailyRuns, 144);
    assert.equal(impact10m.safetyStatus, 'safe');
    assert.ok(impact10m.quotaPercentage < 30); // Consumes only ~10% of 20k quota

    const impactFast = calculateWriteQuotaImpact(1, 65);
    assert.ok(impactFast.quotaPercentage > 90);
    assert.equal(impactFast.safetyStatus, 'danger');
  });

  it('should support draft modifications, live diffs, and versioned publishing', () => {
    const manager = new SettingsManager();
    assert.equal(manager.hasDraftChanges(), false);

    // Modify a draft value
    manager.setDraftValue('rules.trip.minStopMinutes', 25);
    assert.equal(manager.hasDraftChanges(), true);

    const diff = manager.getDiff();
    assert.equal(diff.length, 1);
    assert.equal(diff[0].key, 'rules.trip.minStopMinutes');
    assert.equal(diff[0].oldValue, 20);
    assert.equal(diff[0].newValue, 25);
    assert.equal(diff[0].risk, 'logical');

    // Publish version 2
    const v2 = manager.publishDraft('super_admin', 'زيادة زمن الوقفة لـ 25 دقيقة');
    assert.equal(v2.version, 2);
    assert.equal(manager.hasDraftChanges(), false);
    assert.equal(manager.getSettingValue('rules.trip.minStopMinutes'), 25);

    // Rollback to v1
    const rolledBack = manager.rollbackToVersion(1, 'super_admin');
    assert.equal(rolledBack, true);
    assert.equal(manager.getSettingValue('rules.trip.minStopMinutes'), 20);
  });

  it('should reject invalid values on validation', () => {
    const manager = new SettingsManager();
    const res = manager.setDraftValue('rules.trip.minStopMinutes', 2); // Below min 5
    assert.equal(res.valid, false);
    assert.ok(res.error);
  });

  it('should export and import JSON correctly', () => {
    const manager = new SettingsManager();
    manager.setDraftValue('petro.reorderThreshold', 30000);
    manager.publishDraft('admin', 'تعديل حد Petro');

    const json = manager.exportJSON();
    assert.ok(json.includes('"petro.reorderThreshold": 30000'));

    const newManager = new SettingsManager();
    const imported = newManager.importJSON(json);
    assert.equal(imported.success, true);
    assert.equal(newManager.getSettingValue('petro.reorderThreshold'), 30000);
  });
});