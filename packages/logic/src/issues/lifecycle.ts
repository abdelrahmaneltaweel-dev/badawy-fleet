/**
 * Badawi Fleet Platform - GPS Issue Lifecycle Engine
 * Ref: ADR-019 (دورة حياة المشكلة: مفتوحة ← تم التواصل ← محلولة مع ملاحظة ووقت ومسؤول Super Admin)
 * Ref: Vision §2-ج
 */

import type { IssueDocument, IssueStatus, IssueTransitionOptions, IssueType } from './types.js';

/**
 * Checks if an issue status transition is permitted.
 * Lifecycle path: open -> contacted -> resolved (with reopen permitted).
 */
export function canTransitionIssue(current: IssueStatus, next: IssueStatus): boolean {
  if (current === next) return false;

  switch (current) {
    case 'open':
      return next === 'contacted' || next === 'resolved';
    case 'contacted':
      return next === 'resolved' || next === 'open';
    case 'resolved':
      return next === 'open';
    default:
      return false;
  }
}

/**
 * Returns true if the issue is still active and requires operational attention.
 */
export function isIssueActive(status: IssueStatus): boolean {
  return status === 'open' || status === 'contacted';
}

/**
 * Returns user-friendly Arabic badge details for an issue status.
 */
export function getIssueStatusMeta(status: IssueStatus): {
  label: string;
  badgeClass: string;
  colorVar: string;
} {
  switch (status) {
    case 'open':
      return {
        label: 'مفتوحة (تحتاج إجراء)',
        badgeClass: 'badge-bad',
        colorVar: 'var(--bad)'
      };
    case 'contacted':
      return {
        label: 'تم التواصل مع السائق',
        badgeClass: 'badge-accent',
        colorVar: 'var(--accent)'
      };
    case 'resolved':
      return {
        label: 'محلولة',
        badgeClass: 'badge-ok',
        colorVar: 'var(--ok)'
      };
  }
}

/**
 * Returns Arabic label for GPS issue type.
 */
export function getIssueTypeLabel(type: IssueType): string {
  switch (type) {
    case 'offline':
      return 'انقطاع إشارة GPS';
    case 'frozen_signal':
      return 'إشارة متجمدة بنفس الإحداثيات';
    case 'no_power':
      return 'فصل مصدر الكهرباء';
    default:
      return 'مشكلة بجهاز التتبع';
  }
}

/**
 * Executes a status transition on an IssueDocument, updating lifecycle timestamps,
 * actor credits, notes, and audit history.
 */
export function transitionIssueStatus(
  issue: IssueDocument,
  newStatus: IssueStatus,
  options: IssueTransitionOptions
): IssueDocument {
  if (!canTransitionIssue(issue.status, newStatus)) {
    throw new Error(
      `غير مسموح بنقل حالة المشكلة من '${issue.status}' إلى '${newStatus}'. المسار المعتمد: مفتوحة ← تم التواصل ← محلولة (ADR-019).`
    );
  }

  const now = options.timestamp || new Date().toISOString();
  const historyEntry = {
    status: newStatus,
    timestamp: now,
    actor: options.actor,
    notes: options.notes
  };

  const updated: IssueDocument = {
    ...issue,
    status: newStatus,
    updatedAt: now,
    history: [...(issue.history || []), historyEntry]
  };

  if (newStatus === 'contacted') {
    updated.contactedAt = now;
    updated.contactedBy = options.actor;
    if (options.notes) {
      updated.contactNotes = options.notes;
    }
  } else if (newStatus === 'resolved') {
    updated.resolvedAt = now;
    updated.resolvedBy = options.actor;
    if (options.notes) {
      updated.resolutionNotes = options.notes;
    }
  } else if (newStatus === 'open') {
    // Reopening
    updated.resolvedAt = null;
    updated.resolvedBy = undefined;
    if (options.notes) {
      updated.notes = `${updated.notes || ''} | إعادة فتح: ${options.notes}`;
    }
  }

  return updated;
}

/**
 * Creates an automated IssueDocument from system telemetry/analysis.
 */
export function createAutomatedIssue(params: {
  vehicleId: string;
  operationalDate: string;
  type: IssueType;
  detectedAt?: string;
  offlineMinutes?: number;
  details?: string;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  lastLocationName?: string;
}): IssueDocument {
  const now = new Date().toISOString();
  const detectedAt = params.detectedAt || now;

  return {
    schemaVersion: 1,
    issueId: `issue_${params.vehicleId}_${params.operationalDate}`,
    vehicleId: params.vehicleId,
    type: params.type,
    detectedAt,
    status: 'open',
    resolvedAt: null,
    notes: params.details || `تم رصد ${getIssueTypeLabel(params.type)} تلقائياً أثناء التشغيل`,
    driverId: params.driverId || null,
    driverName: params.driverName || null,
    driverPhone: params.driverPhone || null,
    offlineMinutes: params.offlineMinutes,
    lastLocationName: params.lastLocationName,
    openedBy: 'system',
    createdAt: now,
    updatedAt: now,
    history: [
      {
        status: 'open',
        timestamp: now,
        actor: 'system',
        notes: params.details
      }
    ]
  };
}
