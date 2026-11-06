import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_REGISTRY,
  SETTING_SECTION_LABELS,
  getDefaultSettingsMap,
  validateSettingValue,
  getSettingDefinition
} from '../dist/index.js';

test('Settings Registry: Every setting has required attributes & default values match type', () => {
  assert.ok(SETTINGS_REGISTRY.length >= 15, 'Registry must define comprehensive fleet settings');

  for (const def of SETTINGS_REGISTRY) {
    assert.ok(def.key, 'Setting must have key');
    assert.ok(def.section, `Setting ${def.key} must belong to a section`);
    assert.ok(SETTING_SECTION_LABELS[def.section], `Section ${def.section} must have a registered label`);
    assert.ok(def.label, `Setting ${def.key} must have Arabic label`);
    assert.ok(['visual', 'logical'].includes(def.riskLevel), `Risk level must be visual or logical`);

    // Verify defaultValue type
    if (def.type === 'boolean') {
      assert.strictEqual(typeof def.defaultValue, 'boolean');
    } else if (def.type === 'number') {
      assert.strictEqual(typeof def.defaultValue, 'number');
      if (def.min !== undefined) assert.ok(def.defaultValue >= def.min);
      if (def.max !== undefined) assert.ok(def.defaultValue <= def.max);
    } else if (def.type === 'select') {
      assert.ok(Array.isArray(def.options) && def.options.length > 0);
      assert.ok(def.options.some((o) => o.value === def.defaultValue));
    }
  }
});

test('Settings Registry: getDefaultSettingsMap populates all default values correctly', () => {
  const defaults = getDefaultSettingsMap();
  assert.strictEqual(defaults['trip_day_start_hour'], 6);
  assert.strictEqual(defaults['period_cycle_type'], 'calendar_month');
  assert.strictEqual(defaults['period_freeze_on_close'], true);
  assert.strictEqual(defaults['petro_wallet_credit_limit'], 50000);
});

test('Settings Registry: validateSettingValue enforces safety bounds', () => {
  // Valid tests
  assert.strictEqual(validateSettingValue('trip_day_start_hour', 6).valid, true);
  assert.strictEqual(validateSettingValue('period_freeze_on_close', false).valid, true);
  assert.strictEqual(validateSettingValue('font_family_choice', 'ibm_plex').valid, true);

  // Invalid min bounds
  const tooLow = validateSettingValue('base_font_size_px', 10);
  assert.strictEqual(tooLow.valid, false);
  assert.ok(tooLow.error.includes('الحد الأدنى'));

  // Invalid max bounds
  const tooHigh = validateSettingValue('standing_warning_threshold_minutes', 500);
  assert.strictEqual(tooHigh.valid, false);
  assert.ok(tooHigh.error.includes('الحد الأقصى'));

  // Invalid select option
  const invalidOpt = validateSettingValue('period_cycle_type', 'random_invalid');
  assert.strictEqual(invalidOpt.valid, false);

  // Unknown key
  assert.strictEqual(validateSettingValue('non_existent_key', 123).valid, false);
});