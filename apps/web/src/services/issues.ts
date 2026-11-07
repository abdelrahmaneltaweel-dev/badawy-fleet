/**
 * Badawi Fleet Platform - Web GPS Issues Service
 * Ref: ADR-019 (المشاكل = مشاكل GPS فقط), ADR-011 (WhatsApp wa.me & tel), ADR-018 (Audit log)
 * Manages full GPS issue lifecycle (open -> contacted -> resolved) with Spark quota protection.
 */

import {
  type IssueDocument,
  type IssueType,
  transitionIssueStatus,
  createAutomatedIssue,
  getIssueContactInfo,
  type IssueContactInfo
} from '@badawi/logic';
import { auditService } from './audit';
import { authService } from './auth';
import { entitiesService } from './entities';
import { webSnapshotService } from './snapshot';

const ISSUES_STORAGE_KEY = 'badawi_gps_issues_v1';

// Starter realistic seed issues for the fleet
const SEED_ISSUES: IssueDocument[] = [
  {
    schemaVersion: 1,
    issueId: 'issue_124_current',
    vehicleId: '124',
    type: 'frozen_signal',
    detectedAt: new Date(Date.now() - 35 * 60000).toISOString(),
    status: 'open',
    resolvedAt: null,
    notes: 'إشارة الـ GPS متجمدة بنفس الإحداثيات في جراج الأسطول منذ 35 دقيقة رغم دوران المحرك',
    driverId: 'd-124',
    driverName: 'إسلام عبد الحميد',
    driverPhone: '01012345674',
    offlineMinutes: 35,
    lastLocationName: 'جراج الأسطول المركزي',
    openedBy: 'system',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 35 * 60000).toISOString(),
    history: [
      {
        status: 'open',
        timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
        actor: 'system',
        notes: 'رصد تلقائي: تجمد الإشارة 35 دقيقة مع تشغيل المحرك'
      }
    ]
  },
  {
    schemaVersion: 1,
    issueId: 'issue_118_current',
    vehicleId: '118',
    type: 'offline',
    detectedAt: new Date(Date.now() - 55 * 60000).toISOString(),
    status: 'contacted',
    contactedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    contactedBy: 'أحمد بدوي (Super Admin)',
    contactNotes: 'تم التواصل هاتفياً وواتساب بالسائق، وأفاد بوجود اهتزاز في فيشة الـ GPS وجارٍ تثبيتها',
    resolvedAt: null,
    notes: 'انقطاع إشارة جهاز الـ GPS منذ 55 دقيقة أثناء التواجد بالقرب من الخلاطة الرئيسية',
    driverId: 'd-118',
    driverName: 'محمود سعد الدين',
    driverPhone: '01012345672',
    offlineMinutes: 55,
    lastLocationName: 'الخلاطة الرئيسية',
    openedBy: 'system',
    createdAt: new Date(Date.now() - 55 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    history: [
      {
        status: 'open',
        timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
        actor: 'system',
        notes: 'رصد تلقائي: انقطاع الإشارة لأكثر من 30 دقيقة'
      },
      {
        status: 'contacted',
        timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
        actor: 'أحمد بدوي (Super Admin)',
        notes: 'تم التواصل هاتفياً بالسائق وأفاد بفحص فيشة الجهاز'
      }
    ]
  },
  {
    schemaVersion: 1,
    issueId: 'issue_116_resolved',
    vehicleId: '116',
    type: 'offline',
    detectedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: 'resolved',
    contactedAt: new Date(Date.now() - 3.5 * 3600000).toISOString(),
    contactedBy: 'أحمد بدوي (Super Admin)',
    contactNotes: 'تم الاتصال بالسائق وإعادة توصيل سلك الطاقة',
    resolvedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    resolvedBy: 'أحمد بدوي (Super Admin)',
    resolutionNotes: 'تم حل المشكلة وتأكيد استئناف إرسال الإحداثيات والسرعة بانتظام',
    notes: 'انقطاع إشارة الـ GPS لمدة 40 دقيقة بالقرب من الكسارة 2',
    driverId: 'd-116',
    driverName: 'محمد إبراهيم علي',
    driverPhone: '01012345671',
    offlineMinutes: 40,
    lastLocationName: 'الكسارة 2 (موقع التحميل)',
    openedBy: 'system',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    history: [
      {
        status: 'open',
        timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
        actor: 'system'
      },
      {
        status: 'contacted',
        timestamp: new Date(Date.now() - 3.5 * 3600000).toISOString(),
        actor: 'أحمد بدوي (Super Admin)'
      },
      {
        status: 'resolved',
        timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
        actor: 'أحمد بدوي (Super Admin)',
        notes: 'عادت الإشارة للعمل بانتظام'
      }
    ]
  }
];

type IssueListener = (issues: IssueDocument[]) => void;

class IssuesService {
  private issues: IssueDocument[] = [];
  private listeners = new Set<IssueListener>();

  constructor() {
    this.issues = this.loadFromStorage();
  }

  private loadFromStorage(): IssueDocument[] {
    try {
      const raw = localStorage.getItem(ISSUES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return SEED_ISSUES;
  }

  private saveToStorage() {
    try {
      localStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(this.issues));
    } catch {
      // Ignore
    }
    this.syncWithSnapshot();
    this.notify();
  }

  private syncWithSnapshot() {
    const currentSnap = webSnapshotService.getState().snapshot;
    if (!currentSnap) return;

    // Filter active issues (open + contacted)
    const active = this.issues.filter((i) => i.status === 'open' || i.status === 'contacted');
    const offlineCount = active.filter((i) => i.type === 'offline').length;

    const updatedSnap = {
      ...currentSnap,
      fleetTotals: {
        ...currentSnap.fleetTotals,
        activeIssuesCount: active.length,
        offlineCount: Math.max(currentSnap.fleetTotals.offlineCount, offlineCount)
      },
      recentIssues: active.map((iss) => ({
        issueId: iss.issueId,
        vehicleId: iss.vehicleId,
        type: iss.type,
        detectedAt: iss.detectedAt,
        status: iss.status,
        notes: iss.notes,
        driverId: iss.driverId,
        driverName: iss.driverName,
        driverPhone: iss.driverPhone,
        contactedAt: iss.contactedAt,
        resolvedAt: iss.resolvedAt,
        offlineMinutes: iss.offlineMinutes
      }))
    };

    webSnapshotService.setSnapshot(updatedSnap);
  }

  private notify() {
    const list = [...this.issues];
    this.listeners.forEach((fn) => fn(list));
  }

  public subscribe(fn: IssueListener): () => void {
    this.listeners.add(fn);
    fn([...this.issues]);
    return () => this.listeners.delete(fn);
  }

  public getIssues(): IssueDocument[] {
    return [...this.issues];
  }

  public getActiveIssues(): IssueDocument[] {
    return this.issues.filter((i) => i.status === 'open' || i.status === 'contacted');
  }

  public getIssueById(issueId: string): IssueDocument | undefined {
    return this.issues.find((i) => i.issueId === issueId);
  }

  public getIssueByVehicleId(vehicleId: string): IssueDocument | undefined {
    return this.issues.find((i) => i.vehicleId === vehicleId && (i.status === 'open' || i.status === 'contacted'));
  }

  /**
   * Helper to fetch driver and contact bundle for an issue
   */
  public getContactInfo(issue: IssueDocument): IssueContactInfo {
    let driverName = issue.driverName;
    let driverPhone = issue.driverPhone;

    if (!driverPhone) {
      const assignment = entitiesService.getActiveAssignment(issue.vehicleId);
      if (assignment) {
        const drivers = entitiesService.getDrivers();
        const d = drivers.find((drv) => drv.driverId === assignment.driverId);
        if (d) {
          driverName = d.name;
          driverPhone = d.phone;
        }
      }
    }

    return getIssueContactInfo({
      vehicleId: issue.vehicleId,
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      issueType: issue.type,
      offlineMinutes: issue.offlineMinutes,
      detectedAt: issue.detectedAt,
      locationName: issue.lastLocationName
    });
  }

  /**
   * Transition: open -> contacted (ADR-019)
   */
  public markContacted(issueId: string, notes: string): IssueDocument {
    const idx = this.issues.findIndex((i) => i.issueId === issueId);
    if (idx < 0) {
      throw new Error(`المشكلة رقم ${issueId} غير موجودة`);
    }

    const current = this.issues[idx];
    const currentUser = authService.getCurrentUser();
    const actorName = currentUser ? `${currentUser.displayName} (${authService.getRoleLabel(currentUser.role)})` : 'Super Admin';

    const updated = transitionIssueStatus(current, 'contacted', {
      actor: actorName,
      notes: notes.trim() || 'تم التواصل مع السائق'
    });

    this.issues[idx] = updated;
    this.saveToStorage();

    // ADR-018: Audit logging
    auditService.recordAction({
      action: 'update',
      collection: 'issues',
      documentId: issueId,
      title: `تم التواصل مع السائق لمشكلة الـ GPS (عربية ${updated.vehicleId})`,
      before: current as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>
    });

    return updated;
  }

  /**
   * Transition: contacted or open -> resolved (ADR-019)
   */
  public markResolved(issueId: string, resolutionNotes: string): IssueDocument {
    const idx = this.issues.findIndex((i) => i.issueId === issueId);
    if (idx < 0) {
      throw new Error(`المشكلة رقم ${issueId} غير موجودة`);
    }

    const current = this.issues[idx];
    const currentUser = authService.getCurrentUser();
    const actorName = currentUser ? `${currentUser.displayName} (${authService.getRoleLabel(currentUser.role)})` : 'Super Admin';

    const updated = transitionIssueStatus(current, 'resolved', {
      actor: actorName,
      notes: resolutionNotes.trim() || 'تم حل المشكلة وتأكيد استئناف الإشارة'
    });

    this.issues[idx] = updated;
    this.saveToStorage();

    // ADR-018: Audit logging
    auditService.recordAction({
      action: 'update',
      collection: 'issues',
      documentId: issueId,
      title: `حل مشكلة الـ GPS نهائياً (عربية ${updated.vehicleId})`,
      before: current as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>
    });

    return updated;
  }

  /**
   * Transition: resolved -> open (Reopen)
   */
  public reopenIssue(issueId: string, reason: string): IssueDocument {
    const idx = this.issues.findIndex((i) => i.issueId === issueId);
    if (idx < 0) {
      throw new Error(`المشكلة رقم ${issueId} غير موجودة`);
    }

    const current = this.issues[idx];
    const currentUser = authService.getCurrentUser();
    const actorName = currentUser ? `${currentUser.displayName} (${authService.getRoleLabel(currentUser.role)})` : 'Super Admin';

    const updated = transitionIssueStatus(current, 'open', {
      actor: actorName,
      notes: reason.trim() || 'إعادة فتح المشكلة لمعاودة انقطاع الإشارة'
    });

    this.issues[idx] = updated;
    this.saveToStorage();

    auditService.recordAction({
      action: 'update',
      collection: 'issues',
      documentId: issueId,
      title: `إعادة فتح مشكلة الـ GPS (عربية ${updated.vehicleId})`,
      before: current as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>
    });

    return updated;
  }

  /**
   * Open a new issue manually or from telemetry
   */
  public openIssue(params: {
    vehicleId: string;
    type: IssueType;
    notes?: string;
    offlineMinutes?: number;
  }): IssueDocument {
    const currentUser = authService.getCurrentUser();
    const actor = currentUser?.displayName || 'Super Admin';

    // Check driver info
    const assignment = entitiesService.getActiveAssignment(params.vehicleId);
    let driverId: string | null = null;
    let driverName: string | null = null;
    let driverPhone: string | null = null;

    if (assignment) {
      driverId = assignment.driverId;
      const driver = entitiesService.getDrivers().find((d) => d.driverId === assignment.driverId);
      if (driver) {
        driverName = driver.name;
        driverPhone = driver.phone;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const newDoc = createAutomatedIssue({
      vehicleId: params.vehicleId,
      operationalDate: today,
      type: params.type,
      details: params.notes,
      offlineMinutes: params.offlineMinutes || 30,
      driverId,
      driverName,
      driverPhone
    });

    newDoc.openedBy = actor;

    this.issues.unshift(newDoc);
    this.saveToStorage();

    auditService.recordAction({
      action: 'create',
      collection: 'issues',
      documentId: newDoc.issueId,
      title: `فتح مشكلة GPS جديدة للعربية ${params.vehicleId}`,
      before: null,
      after: newDoc as unknown as Record<string, unknown>
    });

    return newDoc;
  }
}

export const issuesService = new IssuesService();
