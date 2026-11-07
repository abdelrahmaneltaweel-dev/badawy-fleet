/**
 * Badawi Fleet Platform - GPS Issues Lifecycle & Driver Contact Unit Tests (T6.2)
 * Ref: ADR-019 (المشاكل = مشاكل GPS فقط), ADR-011 (WhatsApp wa.me & tel), Vision §2-ج
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateVehicleGpsStatus,
  detectGpsIssueFromAnalysis,
  analyzeVehicleDailyData,
  createAutomatedIssue,
  canTransitionIssue,
  transitionIssueStatus,
  isIssueActive,
  getIssueStatusMeta,
  getIssueTypeLabel,
  normalizeEgyptianPhoneNumber,
  buildTelUrl,
  generateIssueWhatsAppMessage,
  buildWhatsAppIssueUrl,
  getIssueContactInfo,
  buildFleetDailySnapshot
} from '../dist/index.js';

describe('T6.2: GPS Automated Issue Detection, Lifecycle & Contact URLs', () => {
  const refTime = new Date('2026-11-06T12:00:00.000Z');

  describe('1. Automated GPS Issue Detection from Telemetry (ADR-019)', () => {
    it('generates offline issue when vehicle ping is older than threshold (>= 30 mins)', () => {
      // Last ping 45 minutes ago
      const lastPing = new Date('2026-11-06T11:15:00.000Z');
      const points = [
        { deviceId: 101, timestamp: lastPing, latitude: 31.02, longitude: 29.85, speed: 0, attributes: { ignition: false } }
      ];

      const status = evaluateVehicleGpsStatus('114', points, refTime, { offlineThresholdMinutes: 30 });
      assert.equal(status.status, 'offline');
      assert.equal(status.hasActiveIssue, true);
      assert.equal(status.issueType, 'offline');
      assert.equal(status.offlineMinutes, 45);

      const analysis = analyzeVehicleDailyData(
        { id: '114', type: 'tractor', name: 'عربية 114' },
        points,
        [],
        '2026-11-06',
        refTime,
        { offlineThresholdMinutes: 30 }
      );

      const issueDoc = detectGpsIssueFromAnalysis(analysis, {
        driverId: 'd-114',
        driverName: 'سعيد سالم',
        driverPhone: '01012345678'
      });

      assert.ok(issueDoc);
      assert.equal(issueDoc.vehicleId, '114');
      assert.equal(issueDoc.type, 'offline');
      assert.equal(issueDoc.status, 'open');
      assert.equal(issueDoc.driverName, 'سعيد سالم');
      assert.equal(issueDoc.driverPhone, '01012345678');
      assert.equal(issueDoc.openedBy, 'system');
      assert.equal(issueDoc.offlineMinutes, 45);
      assert.ok(issueDoc.notes.includes('انقطاع'));
    });

    it('generates frozen_signal issue when coordinates remain identical with ignition on for >= 30 mins', () => {
      const points = [];
      const baseLat = 31.02500;
      const baseLng = 29.85100;
      // 6 points over 35 minutes with exact same coordinates and ignition: true
      for (let i = 0; i <= 35; i += 7) {
        points.push({
          deviceId: 102,
          timestamp: new Date(refTime.getTime() - (35 - i) * 60000),
          latitude: baseLat,
          longitude: baseLng,
          speed: 15, // claimed speed
          attributes: { ignition: true }
        });
      }

      const status = evaluateVehicleGpsStatus('124', points, refTime);
      assert.equal(status.status, 'frozen_signal');
      assert.equal(status.hasActiveIssue, true);
      assert.equal(status.issueType, 'frozen_signal');

      const analysis = analyzeVehicleDailyData(
        { id: '124', type: 'truck', name: 'عربية 124' },
        points,
        [],
        '2026-11-06',
        refTime
      );

      const issueDoc = detectGpsIssueFromAnalysis(analysis, {
        driverId: 'd-124',
        driverName: 'إسلام عبد الحميد',
        driverPhone: '01012345674'
      });

      assert.ok(issueDoc);
      assert.equal(issueDoc.vehicleId, '124');
      assert.equal(issueDoc.type, 'frozen_signal');
      assert.equal(issueDoc.status, 'open');
      assert.equal(issueDoc.driverName, 'إسلام عبد الحميد');
    });

    it('returns null when vehicle is operational with fresh coordinates', () => {
      const points = [
        {
          deviceId: 103,
          timestamp: new Date('2026-11-06T11:58:00.000Z'),
          latitude: 31.02,
          longitude: 29.85,
          speed: 35,
          attributes: { ignition: true }
        }
      ];

      const status = evaluateVehicleGpsStatus('116', points, refTime);
      assert.equal(status.hasActiveIssue, false);

      const analysis = analyzeVehicleDailyData(
        { id: '116', type: 'tractor', name: 'عربية 116' },
        points,
        [],
        '2026-11-06',
        refTime
      );

      const issueDoc = detectGpsIssueFromAnalysis(analysis);
      assert.equal(issueDoc, null);
    });
  });

  describe('2. Issue Lifecycle State Machine (ADR-019)', () => {
    it('validates allowed status transitions: open -> contacted -> resolved', () => {
      assert.equal(canTransitionIssue('open', 'contacted'), true);
      assert.equal(canTransitionIssue('contacted', 'resolved'), true);
      assert.equal(canTransitionIssue('open', 'resolved'), true);
      assert.equal(canTransitionIssue('resolved', 'open'), true); // Reopen
      assert.equal(canTransitionIssue('contacted', 'open'), true); // Reset
      assert.equal(canTransitionIssue('resolved', 'contacted'), false); // Cannot contact already resolved without reopen
      assert.equal(canTransitionIssue('open', 'open'), false);
    });

    it('transitions from open to contacted with actor and notes recorded', () => {
      const issue = createAutomatedIssue({
        vehicleId: '114',
        operationalDate: '2026-11-06',
        type: 'offline',
        offlineMinutes: 40,
        driverName: 'سعيد سالم',
        driverPhone: '01012345678'
      });

      assert.equal(issue.status, 'open');
      assert.equal(isIssueActive(issue.status), true);

      const contacted = transitionIssueStatus(issue, 'contacted', {
        actor: 'أحمد بدوي (Super Admin)',
        notes: 'تم الاتصال بالسائق وأفاد بوجود مشكلة في فيشة الجهاز ويقوم بفحصها'
      });

      assert.equal(contacted.status, 'contacted');
      assert.equal(contacted.contactedBy, 'أحمد بدوي (Super Admin)');
      assert.ok(contacted.contactedAt);
      assert.equal(contacted.contactNotes, 'تم الاتصال بالسائق وأفاد بوجود مشكلة في فيشة الجهاز ويقوم بفحصها');
      assert.equal(isIssueActive(contacted.status), true);
      assert.equal(contacted.history.length, 2);
    });

    it('transitions from contacted to resolved with resolution timestamp and notes', () => {
      const issue = createAutomatedIssue({
        vehicleId: '114',
        operationalDate: '2026-11-06',
        type: 'offline',
        offlineMinutes: 40
      });

      const contacted = transitionIssueStatus(issue, 'contacted', {
        actor: 'Super Admin',
        notes: 'تم التواصل مع السائق'
      });

      const resolved = transitionIssueStatus(contacted, 'resolved', {
        actor: 'Super Admin',
        notes: 'تم تثبيت فيشة الـ GPS وعادت الإشارة للظهور بشكل طبيعي'
      });

      assert.equal(resolved.status, 'resolved');
      assert.equal(resolved.resolvedBy, 'Super Admin');
      assert.ok(resolved.resolvedAt);
      assert.equal(resolved.resolutionNotes, 'تم تثبيت فيشة الـ GPS وعادت الإشارة للظهور بشكل طبيعي');
      assert.equal(isIssueActive(resolved.status), false);
      assert.equal(resolved.history.length, 3);
    });

    it('throws when attempting an illegal transition', () => {
      const issue = createAutomatedIssue({
        vehicleId: '114',
        operationalDate: '2026-11-06',
        type: 'offline'
      });
      const resolved = transitionIssueStatus(issue, 'resolved', { actor: 'Admin' });

      assert.throws(() => {
        transitionIssueStatus(resolved, 'contacted', { actor: 'Admin' });
      }, /غير مسموح بنقل حالة المشكلة/);
    });

    it('returns informative Arabic status and type metadata', () => {
      const openMeta = getIssueStatusMeta('open');
      assert.ok(openMeta.label.includes('مفتوحة'));

      const contactedMeta = getIssueStatusMeta('contacted');
      assert.ok(contactedMeta.label.includes('تم التواصل'));

      const resolvedMeta = getIssueStatusMeta('resolved');
      assert.ok(resolvedMeta.label.includes('محلولة'));

      assert.equal(getIssueTypeLabel('offline'), 'انقطاع إشارة GPS');
      assert.equal(getIssueTypeLabel('frozen_signal'), 'إشارة متجمدة بنفس الإحداثيات');
    });
  });

  describe('3. WhatsApp wa.me & Direct Tel URL Construction (ADR-011)', () => {
    it('normalizes Egyptian phone numbers to international format without plus sign', () => {
      assert.equal(normalizeEgyptianPhoneNumber('01012345671'), '201012345671');
      assert.equal(normalizeEgyptianPhoneNumber('+201012345671'), '201012345671');
      assert.equal(normalizeEgyptianPhoneNumber('012 3456 7890'), '201234567890');
      assert.equal(normalizeEgyptianPhoneNumber('01155554444'), '201155554444');
    });

    it('constructs correct tel: URI', () => {
      assert.equal(buildTelUrl('01012345671'), 'tel:01012345671');
      assert.equal(buildTelUrl('+201012345671'), 'tel:+201012345671');
    });

    it('generates tailored Arabic message for offline GPS with duration and vehicle number', () => {
      const msg = generateIssueWhatsAppMessage({
        vehicleId: '114',
        vehicleName: 'عربية 114',
        driverName: 'سعيد سالم',
        issueType: 'offline',
        offlineMinutes: 38
      });

      assert.ok(msg.includes('سعيد سالم'));
      assert.ok(msg.includes('عربية 114'));
      assert.ok(msg.includes('38 دقيقة'));
      assert.ok(msg.includes('انقطاع إشارة'));
      assert.ok(msg.includes('توصيلات الكهرباء'));
    });

    it('generates tailored Arabic message for frozen signal', () => {
      const msg = generateIssueWhatsAppMessage({
        vehicleId: '124',
        vehicleName: 'عربية 124',
        driverName: 'إسلام عبد الحميد',
        issueType: 'frozen_signal',
        offlineMinutes: 30
      });

      assert.ok(msg.includes('إسلام عبد الحميد'));
      assert.ok(msg.includes('متجمدة'));
      assert.ok(msg.includes('تشغيل المحرك'));
    });

    it('builds full wa.me link with encoded Arabic text', () => {
      const url = buildWhatsAppIssueUrl('01012345678', 'السلام عليكم');
      assert.ok(url.startsWith('https://wa.me/201012345678?text='));
      assert.ok(url.includes('%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85'));
    });

    it('returns complete contact bundle from getIssueContactInfo', () => {
      const bundle = getIssueContactInfo({
        vehicleId: '118',
        driverName: 'محمود سعد الدين',
        driverPhone: '01012345672',
        issueType: 'offline',
        offlineMinutes: 45
      });

      assert.equal(bundle.driverName, 'محمود سعد الدين');
      assert.equal(bundle.driverPhone, '01012345672');
      assert.equal(bundle.telUrl, 'tel:01012345672');
      assert.ok(bundle.whatsAppUrl.startsWith('https://wa.me/201012345672?text='));
      assert.ok(bundle.whatsAppMessage.length > 20);
    });
  });

  describe('4. Snapshot Integration & Active Issue Counters', () => {
    it('counts both open and contacted issues as active in daily snapshot totals', () => {
      const targets = [
        { vehicleId: '114', name: 'عربية 114', type: 'tractor', plateNumber: 'أ 114', status: 'offline' },
        { vehicleId: '116', name: 'عربية 116', type: 'tractor', plateNumber: 'أ 116', status: 'online' },
        { vehicleId: '124', name: 'عربية 124', type: 'truck', plateNumber: 'أ 124', status: 'offline' }
      ];

      const issues = [
        createAutomatedIssue({ vehicleId: '114', operationalDate: '2026-11-06', type: 'offline' }),
        {
          ...createAutomatedIssue({ vehicleId: '124', operationalDate: '2026-11-06', type: 'frozen_signal' }),
          status: 'contacted',
          contactedAt: '2026-11-06T11:00:00Z',
          contactedBy: 'Admin'
        }
      ];

      const snapshot = buildFleetDailySnapshot({
        operationalDate: '2026-11-06',
        summaries: [],
        targets,
        issues
      });

      assert.equal(snapshot.fleetTotals.activeIssuesCount, 2);
      assert.equal(snapshot.recentIssues.length, 2);

      // Resolving one issue decrements activeIssuesCount
      const resolvedIssues = [
        issues[0],
        { ...issues[1], status: 'resolved', resolvedAt: '2026-11-06T11:30:00Z' }
      ];

      const updatedSnapshot = buildFleetDailySnapshot({
        operationalDate: '2026-11-06',
        summaries: [],
        targets,
        issues: resolvedIssues
      });

      assert.equal(updatedSnapshot.fleetTotals.activeIssuesCount, 1);
      assert.equal(updatedSnapshot.recentIssues.length, 1);
      assert.notEqual(snapshot.checksum, updatedSnapshot.checksum);
    });
  });
});
