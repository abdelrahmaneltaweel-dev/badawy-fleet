/**
 * Badawi Fleet Platform - Audit Log & On-Behalf Logic Helpers
 * ADR References: ADR-018 (onBehalfOf tracking), ADR-056 (24-month retention)
 */

import type { UserRole } from '../auth/permissions.js';
import type { CollectionName, AuditAction } from '../schema/types.js';
import type {
  AuditLogItem,
  AuditDiffMap,
  AuditFilterParams
} from './types.js';

/**
 * Checks whether a role is authorized to perform actions on behalf of another user.
 * As per ADR-018: Super Admin alone is authorized to act on behalf of users.
 */
export function canActOnBehalf(role: UserRole): boolean {
  return role === 'super_admin';
}

/**
 * Calculates key-by-key difference between two objects (before vs after).
 */
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): AuditDiffMap {
  const diff: AuditDiffMap = {};
  const b = before || {};
  const a = after || {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);

  for (const key of allKeys) {
    if (key === 'updatedAt' || key === 'createdAt' || key === 'schemaVersion') {
      continue;
    }

    const valBefore = b[key];
    const valAfter = a[key];

    // Deep comparison using JSON stringification for simplicity and safety
    const strBefore = JSON.stringify(valBefore);
    const strAfter = JSON.stringify(valAfter);

    if (strBefore !== strAfter) {
      diff[key] = {
        before: valBefore === undefined ? null : valBefore,
        after: valAfter === undefined ? null : valAfter
      };
    }
  }

  return diff;
}

const ACTION_TITLES_AR: Record<AuditAction, string> = {
  create: 'إنشاء عنصر جديد',
  update: 'تعديل بيانات',
  delete: 'حذف عنصر',
  close_period: 'إغلاق واعتماد الفترة المالية',
  open_period: 'إعادة فتح فترة مقفولة',
  override: 'تطبيق تعديل يدوي (Override)'
};

const COLLECTION_TITLES_AR: Record<CollectionName, string> = {
  vehicles: 'العربيات',
  drivers: 'السائقين',
  assignments: 'إسناد السائقين',
  sites: 'المواقع الجغرافية',
  inquiries: 'الاستفسارات',
  issues: 'مشاكل GPS',
  statements: 'البيانات المساندة',
  daily_summaries: 'الملخصات اليومية',
  petro_requests: 'طلبات العهدة (Petro)',
  settings: 'سجل الإعدادات',
  audit_logs: 'سجل المراجعة',
  period_snapshots: 'لقطات الفترات'
};

/**
 * Formats a descriptive Arabic title for an audit event.
 */
export function generateAuditTitle(
  action: AuditAction,
  collection: CollectionName,
  documentId: string,
  onBehalfOfName: string | null
): string {
  const actionText = ACTION_TITLES_AR[action] || action;
  const colText = COLLECTION_TITLES_AR[collection] || collection;

  let title = `${actionText} في ${colText} [معرف: ${documentId}]`;
  if (onBehalfOfName) {
    title += ` (بالنيابة عن: ${onBehalfOfName})`;
  }
  return title;
}

/**
 * Factory for creating verified, schema-compliant AuditLogItem records.
 * Enforces mandatory tracking of enteredBy and onBehalfOf (ADR-018).
 */
export function buildAuditLogItem(params: {
  logId?: string;
  userId: string;
  userName: string;
  enteredBy: string;
  enteredByName: string;
  onBehalfOf?: string | null;
  onBehalfOfName?: string | null;
  action: AuditAction;
  collection: CollectionName;
  documentId: string;
  title?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  timestamp?: string;
}): AuditLogItem {
  const now = params.timestamp || new Date().toISOString();
  const onBehalfId = params.onBehalfOf || null;
  const onBehalfName = params.onBehalfOfName || null;
  const diff = computeDiff(params.before, params.after);

  const title =
    params.title ||
    generateAuditTitle(params.action, params.collection, params.documentId, onBehalfName);

  return {
    schemaVersion: 1,
    logId: params.logId || `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    userId: params.userId,
    userName: params.userName,
    enteredBy: params.enteredBy,
    enteredByName: params.enteredByName,
    onBehalfOf: onBehalfId,
    onBehalfOfName: onBehalfName,
    action: params.action,
    collection: params.collection,
    documentId: params.documentId,
    title,
    before: params.before || null,
    after: params.after || null,
    diff,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Filters audit log entries based on criteria.
 */
export function filterAuditLogs(
  logs: AuditLogItem[],
  filters: AuditFilterParams
): AuditLogItem[] {
  return logs.filter((log) => {
    if (filters.collection && filters.collection !== 'all' && log.collection !== filters.collection) {
      return false;
    }

    if (filters.action && filters.action !== 'all' && log.action !== filters.action) {
      return false;
    }

    if (filters.onBehalfOnly && !log.onBehalfOf) {
      return false;
    }

    if (filters.enteredBy && log.enteredBy !== filters.enteredBy) {
      return false;
    }

    if (filters.startDate) {
      const logDate = log.timestamp.slice(0, 10);
      if (logDate < filters.startDate) return false;
    }

    if (filters.endDate) {
      const logDate = log.timestamp.slice(0, 10);
      if (logDate > filters.endDate) return false;
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      const matchDoc = log.documentId.toLowerCase().includes(q);
      const matchTitle = log.title.toLowerCase().includes(q);
      const matchOperator = log.enteredByName.toLowerCase().includes(q);
      const matchOnBehalf = log.onBehalfOfName ? log.onBehalfOfName.toLowerCase().includes(q) : false;
      if (!matchDoc && !matchTitle && !matchOperator && !matchOnBehalf) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if an audit record has exceeded the 24-month retention period (ADR-056).
 */
export function isAuditExpired(timestamp: string, retentionMonths = 24): { isExpired: boolean; ageMonths: number } {
  const logDate = new Date(timestamp);
  const now = new Date();

  const diffMonths = (now.getFullYear() - logDate.getFullYear()) * 12 + (now.getMonth() - logDate.getMonth());
  return {
    isExpired: diffMonths >= retentionMonths,
    ageMonths: Math.max(0, diffMonths)
  };
}
