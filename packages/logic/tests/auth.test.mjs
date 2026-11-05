import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS
} from '../dist/index.js';

describe('Role & Granular Permission Checks (T3.3)', () => {
  it('should grant Super Admin all permissions unconditionally', () => {
    assert.equal(hasPermission('super_admin', 'users.manage'), true);
    assert.equal(hasPermission('super_admin', 'period.close'), true);
    assert.equal(hasPermission('super_admin', 'report.edit'), true);
  });

  it('should restrict Management role to read and export only', () => {
    assert.equal(hasPermission('management', 'report.view'), true);
    assert.equal(hasPermission('management', 'report.export'), true);
    assert.equal(hasPermission('management', 'report.edit'), false);
    assert.equal(hasPermission('management', 'period.close'), false);
    assert.equal(hasPermission('management', 'users.manage'), false);
  });

  it('should restrict Drivers to own trip statements and replies', () => {
    assert.equal(hasPermission('driver', 'statement.driver.create'), true);
    assert.equal(hasPermission('driver', 'inquiry.reply'), true);
    assert.equal(hasPermission('driver', 'report.view'), false);
    assert.equal(hasPermission('driver', 'statement.mixer.create'), false);
  });

  it('should correctly honor custom allow and deny overrides', () => {
    // Grant management temporary report.edit permission via override
    assert.equal(
      hasPermission('management', 'report.edit', { allow: ['report.edit'] }),
      true
    );

    // Deny driver reply if explicitly overridden
    assert.equal(
      hasPermission('driver', 'inquiry.reply', { deny: ['inquiry.reply'] }),
      false
    );
  });

  it('should have labels defined for all 6 roles', () => {
    const roles = Object.keys(ROLE_DEFAULT_PERMISSIONS);
    assert.equal(roles.length, 6);
    roles.forEach((r) => {
      assert.ok(ROLE_LABELS[r]);
    });
  });
});