import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DASHBOARD_CARDS_ORDER,
  DASHBOARD_CARDS_CATALOG,
  resolveDashboardCards,
  moveDashboardCard,
  SETTINGS_REGISTRY,
  getDefaultSettingsMap
} from '../dist/index.js';

test('T6.1: Dashboard Cards Catalog & Canonical Order (ADR-059, Decision D-059)', () => {
  assert.strictEqual(CANONICAL_DASHBOARD_CARDS_ORDER.length, 6);
  assert.deepStrictEqual(CANONICAL_DASHBOARD_CARDS_ORDER, [
    'fleet_status',
    'gps_issues',
    'inquiries_pending',
    'tractor_hauls',
    'truck_trips',
    'petro_wallet'
  ]);

  for (const cardId of CANONICAL_DASHBOARD_CARDS_ORDER) {
    const meta = DASHBOARD_CARDS_CATALOG[cardId];
    assert.ok(meta, `Card ${cardId} must exist in catalog`);
    assert.strictEqual(meta.id, cardId);
    assert.ok(meta.title.length > 0, `Card ${cardId} must have an Arabic title`);
    assert.ok(meta.subtitle.length > 0, `Card ${cardId} must have an Arabic subtitle`);
    assert.ok(meta.icon.length > 0, `Card ${cardId} must have an icon`);
    assert.strictEqual(meta.defaultVisible, true);
    assert.ok(meta.settingKey.startsWith('dashboard_show_'));
  }
});

test('T6.1: Settings Registry defines all 6 card toggles and order string', () => {
  const defaults = getDefaultSettingsMap();

  assert.strictEqual(typeof defaults['dashboard_cards_order'], 'string');
  assert.ok(defaults['dashboard_cards_order'].includes('fleet_status'));
  assert.ok(defaults['dashboard_cards_order'].includes('petro_wallet'));

  const expectedToggles = [
    'dashboard_show_fleet_status',
    'dashboard_show_gps_issues',
    'dashboard_show_inquiries',
    'dashboard_show_tractor_hauls',
    'dashboard_show_truck_trips',
    'dashboard_show_wallet_card'
  ];

  for (const toggleKey of expectedToggles) {
    assert.strictEqual(defaults[toggleKey], true, `Default for ${toggleKey} must be true`);
    const def = SETTINGS_REGISTRY.find((s) => s.key === toggleKey);
    assert.ok(def, `Setting definition for ${toggleKey} must exist in registry`);
    assert.strictEqual(def.section, 'navigation_dashboard');
    assert.strictEqual(def.type, 'boolean');
    assert.strictEqual(def.riskLevel, 'visual');
  }
});

test('T6.1: resolveDashboardCards with defaults returns all 6 cards in order', () => {
  const cards = resolveDashboardCards({});
  assert.strictEqual(cards.length, 6);
  assert.strictEqual(cards[0].id, 'fleet_status');
  assert.strictEqual(cards[1].id, 'gps_issues');
  assert.strictEqual(cards[2].id, 'inquiries_pending');
  assert.strictEqual(cards[3].id, 'tractor_hauls');
  assert.strictEqual(cards[4].id, 'truck_trips');
  assert.strictEqual(cards[5].id, 'petro_wallet');
});

test('T6.1: resolveDashboardCards respects visibility toggles', () => {
  const settings = {
    dashboard_show_fleet_status: true,
    dashboard_show_gps_issues: false, // hide
    dashboard_show_inquiries: true,
    dashboard_show_tractor_hauls: false, // hide
    dashboard_show_truck_trips: true,
    dashboard_show_wallet_card: true
  };

  const cards = resolveDashboardCards(settings);
  assert.strictEqual(cards.length, 4);
  const ids = cards.map((c) => c.id);
  assert.deepStrictEqual(ids, ['fleet_status', 'inquiries_pending', 'truck_trips', 'petro_wallet']);
  assert.ok(!ids.includes('gps_issues'));
  assert.ok(!ids.includes('tractor_hauls'));
});

test('T6.1: resolveDashboardCards respects custom card order', () => {
  const customOrder = 'petro_wallet,tractor_hauls,fleet_status,truck_trips,gps_issues,inquiries_pending';
  const cards = resolveDashboardCards({
    dashboard_cards_order: customOrder
  });

  assert.strictEqual(cards.length, 6);
  assert.strictEqual(cards[0].id, 'petro_wallet');
  assert.strictEqual(cards[1].id, 'tractor_hauls');
  assert.strictEqual(cards[2].id, 'fleet_status');
  assert.strictEqual(cards[3].id, 'truck_trips');
  assert.strictEqual(cards[4].id, 'gps_issues');
  assert.strictEqual(cards[5].id, 'inquiries_pending');
});

test('T6.1: resolveDashboardCards handles partial or unknown IDs gracefully', () => {
  // Only two IDs specified, and one unknown ID
  const partialOrder = 'tractor_hauls,unknown_card_id,petro_wallet';
  const cards = resolveDashboardCards({
    dashboard_cards_order: partialOrder
  });

  assert.strictEqual(cards.length, 6);
  // Specified valid cards come first in specified order
  assert.strictEqual(cards[0].id, 'tractor_hauls');
  assert.strictEqual(cards[1].id, 'petro_wallet');
  // Followed by the remaining canonical cards
  const remainingIds = cards.slice(2).map((c) => c.id);
  assert.deepStrictEqual(remainingIds, ['fleet_status', 'gps_issues', 'inquiries_pending', 'truck_trips']);
});

test('T6.1: moveDashboardCard reorders items with bounds safety', () => {
  const initial = 'fleet_status,gps_issues,inquiries_pending,tractor_hauls,truck_trips,petro_wallet';

  // Move 2nd card up -> becomes 1st
  const movedUp = moveDashboardCard(initial, 'gps_issues', 'up');
  assert.strictEqual(
    movedUp,
    'gps_issues,fleet_status,inquiries_pending,tractor_hauls,truck_trips,petro_wallet'
  );

  // Move top card up -> bounds safety, no change
  const topUp = moveDashboardCard(initial, 'fleet_status', 'up');
  assert.strictEqual(topUp, initial);

  // Move 5th card down -> becomes 6th
  const movedDown = moveDashboardCard(initial, 'truck_trips', 'down');
  assert.strictEqual(
    movedDown,
    'fleet_status,gps_issues,inquiries_pending,tractor_hauls,petro_wallet,truck_trips'
  );

  // Move last card down -> bounds safety, no change
  const bottomDown = moveDashboardCard(initial, 'petro_wallet', 'down');
  assert.strictEqual(bottomDown, initial);
});
