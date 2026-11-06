import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_FONTS,
  FONT_SIZE_BOUNDS,
  DEFAULT_PERSONAL_PREFERENCES,
  getCuratedFont,
  validateFontSize
} from '../dist/index.js';

test('Appearance: Curated fonts contains 4 open-licensed Arabic fonts (ADR-058)', () => {
  assert.strictEqual(CURATED_FONTS.length, 4, 'Must have exactly 4 curated Arabic fonts');

  const ids = CURATED_FONTS.map((f) => f.id);
  assert.ok(ids.includes('ibm_plex'), 'Must include IBM Plex Sans Arabic');
  assert.ok(ids.includes('tajawal'), 'Must include Tajawal');
  assert.ok(ids.includes('cairo'), 'Must include Cairo');
  assert.ok(ids.includes('noto_sans'), 'Must include Noto Sans Arabic');

  for (const font of CURATED_FONTS) {
    assert.strictEqual(font.license, 'OFL', 'All curated fonts must have open font license');
    assert.ok(font.cssFamily.includes('sans-serif'), 'CSS fallback must include sans-serif');
  }

  const defaultFont = CURATED_FONTS.find((f) => f.isDefault);
  assert.ok(defaultFont, 'Must have an official default font');
  assert.strictEqual(defaultFont.id, 'ibm_plex', 'IBM Plex must be the default font');
});

test('Appearance: Font size boundary safety guards (13px - 18px)', () => {
  assert.strictEqual(validateFontSize(15), true);
  assert.strictEqual(validateFontSize(13), true);
  assert.strictEqual(validateFontSize(18), true);

  assert.strictEqual(validateFontSize(12), false, '12px is too small for readability');
  assert.strictEqual(validateFontSize(19), false, '19px is too large for UI density');
  assert.strictEqual(validateFontSize(NaN), false);
});

test('Appearance: getCuratedFont fallbacks safely on invalid font', () => {
  const valid = getCuratedFont('tajawal');
  assert.strictEqual(valid.id, 'tajawal');

  const invalid = getCuratedFont('unknown_custom_font');
  assert.strictEqual(invalid.id, 'ibm_plex', 'Must fallback to default font');
});