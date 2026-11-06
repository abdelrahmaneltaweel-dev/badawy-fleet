/**
 * Badawi Fleet Platform - Audit Log Service
 * Enforces enteredBy and onBehalfOf tracking, diff capture, and retention (ADR-018, ADR-056)
 */

import {
  type AuditLogItem,
  type AuditFilterParams,
  type AuditAction,
  type CollectionName,
  buildAuditLogItem,
  filterAuditLogs
} from '@badawi/logic';
import { authService, type UserProfile } from './auth';

const AUDIT_STORAGE_KEY = 'badawi_audit_logs_v1';
const ON_BEHALF_STORAGE_KEY = 'badawi_active_on_behalf_v1';

// Pre-seeded audit logs demonstrating ADR-018 and ADR-056
const SEED_AUDIT_LOGS: AuditLogItem[] = [
  {
    schemaVersion: 1,
    logId: 'audit-seed-01',
    timestamp: '2026-10-28T09:30:00Z',
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: 'u-feisal-mixer',
    onBehalfOfName: 'أ. فيصل (مدير الخلاطة)',
    action: 'update',
    collection: 'statements',
    documentId: 'stmt-2026-10-28-01',
    title: 'تعديل بيانات في البيانات المساندة [معرف: stmt-2026-10-28-01] (بالنيابة عن: أ. فيصل)',
    before: { tripsCount: 12, approved: false, notes: 'بيان مبدئي' },
    after: { tripsCount: 14, approved: true, notes: 'اعتماد يدوي بعد مراجعة البونات' },
    diff: {
      tripsCount: { before: 12, after: 14 },
      approved: { before: false, after: true },
      notes: { before: 'بيان مبدئي', after: 'اعتماد يدوي بعد مراجعة البونات' }
    },
    createdAt: '2026-10-28T09:30:00Z',
    updatedAt: '2026-10-28T09:30:00Z'
  },
  {
    schemaVersion: 1,
    logId: 'audit-seed-02',
    timestamp: '2026-10-25T14:15:00Z',
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: null,
    onBehalfOfName: null,
    action: 'update',
    collection: 'assignments',
    documentId: 'as-1',
    title: 'تعديل بيانات في إسناد السائقين [معرف: as-1]',
    before: { vehicleId: '116', driverId: 'd-118' },
    after: { vehicleId: '116', driverId: 'd-116' },
    diff: {
      driverId: { before: 'd-118', after: 'd-116' }
    },
    createdAt: '2026-10-25T14:15:00Z',
    updatedAt: '2026-10-25T14:15:00Z'
  },
  {
    schemaVersion: 1,
    logId: 'audit-seed-03',
    timestamp: '2026-10-20T11:00:00Z',
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: 'u-driver-116',
    onBehalfOfName: 'محمد إبراهيم (سائق 116)',
    action: 'create',
    collection: 'inquiries',
    documentId: 'inq-401',
    title: 'إنشاء عنصر جديد في الاستفسارات [معرف: inq-401] (بالنيابة عن: محمد إبراهيم)',
    before: null,
    after: { vehicleId: '116', question: 'استفسار عن احتساب نقلة طريق الساحل', status: 'pending' },
    diff: {
      vehicleId: { before: null, after: '116' },
      question: { before: null, after: 'استفسار عن احتساب نقلة طريق الساحل' },
      status: { before: null, after: 'pending' }
    },
    createdAt: '2026-10-20T11:00:00Z',
    updatedAt: '2026-10-20T11:00:00Z'
  },
  {
    schemaVersion: 1,
    logId: 'audit-seed-04',
    timestamp: '2026-10-15T08:00:00Z',
    userId: 'u-super-admin',
    userName: 'أحمد بدوي',
    enteredBy: 'u-super-admin',
    enteredByName: 'أحمد بدوي',
    onBehalfOf: null,
    onBehalfOfName: null,
    action: 'create',
    collection: 'vehicles',
    documentId: '124',
    title: 'إنشاء عنصر جديد في العربيات [معرف: 124]',
    before: null,
    after: { vehicleId: '124', name: 'عربية 124', plateNumber: 'ز ح ط 9054', type: 'truck' },
    diff: {
      vehicleId: { before: null, after: '124' },
      name: { before: null, after: 'عربية 124' },
      type: { before: null, after: 'truck' }
    },
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-10-15T08:00:00Z'
  }
];

type AuditListener = () => void;
const listeners = new Set<AuditListener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function loadLogs(): AuditLogItem[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return SEED_AUDIT_LOGS;
}

function saveLogs(logs: AuditLogItem[]) {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Ignore
  }
}

export const auditService = {
  getLogs(filters?: AuditFilterParams): AuditLogItem[] {
    const all = loadLogs();
    if (!filters) return all;
    return filterAuditLogs(all, filters);
  },

  /**
   * Retrieves the currently active user being represented (onBehalfOf).
   * ADR-018: Super Admin can act on behalf of another user.
   */
  getActiveOnBehalfUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(ON_BEHALF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Activates or clears On-Behalf mode for Super Admin (ADR-018).
   */
  setActiveOnBehalfUser(user: UserProfile | null): void {
    try {
      if (user) {
        localStorage.setItem(ON_BEHALF_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(ON_BEHALF_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    notify();
  },

  /**
   * Records an audit event attaching enteredBy and onBehalfOf credentials.
   */
  recordAction(params: {
    action: AuditAction;
    collection: CollectionName;
    documentId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    title?: string;
    overrideOnBehalf?: UserProfile | null;
  }): AuditLogItem {
    const currentUser = authService.getCurrentUser() || {
      uid: 'u-system',
      displayName: 'النظام الآلي'
    };

    // Determine On-Behalf status: explicitly passed or currently active in session
    const activeOnBehalf = params.overrideOnBehalf !== undefined
      ? params.overrideOnBehalf
      : this.getActiveOnBehalfUser();

    const logItem = buildAuditLogItem({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      enteredBy: currentUser.uid,
      enteredByName: currentUser.displayName,
      onBehalfOf: activeOnBehalf ? activeOnBehalf.uid : null,
      onBehalfOfName: activeOnBehalf ? activeOnBehalf.displayName : null,
      action: params.action,
      collection: params.collection,
      documentId: params.documentId,
      title: params.title,
      before: params.before,
      after: params.after
    });

    const list = loadLogs();
    list.unshift(logItem);
    saveLogs(list);
    notify();

    return logItem;
  },

  /**
   * Cleans up expired logs according to ADR-056 (24-month retention).
   */
  cleanupExpiredLogs(retentionMonths = 24): number {
    const list = loadLogs();
    const now = new Date();
    const kept: AuditLogItem[] = [];
    let removed = 0;

    for (const item of list) {
      const itemDate = new Date(item.timestamp);
      const diffMonths = (now.getFullYear() - itemDate.getFullYear()) * 12 + (now.getMonth() - itemDate.getMonth());
      if (diffMonths < retentionMonths) {
        kept.push(item);
      } else {
        removed++;
      }
    }

    if (removed > 0) {
      saveLogs(kept);
      notify();
    }
    return removed;
  },

  subscribe(listener: AuditListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
