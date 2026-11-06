import type { CollectionName, AuditAction } from '../schema/types.js';

export interface AuditDiffField {
  before: unknown;
  after: unknown;
}

export type AuditDiffMap = Record<string, AuditDiffField>;

export interface AuditLogItem {
  schemaVersion: number;
  logId: string;
  timestamp: string; // ISO
  userId: string;
  userName: string;
  enteredBy: string; // User ID of the actual operator
  enteredByName: string; // Operator display name
  onBehalfOf: string | null; // Target user ID if acting on behalf, otherwise null (ADR-018)
  onBehalfOfName: string | null; // Target user display name if acting on behalf
  action: AuditAction;
  collection: CollectionName;
  documentId: string;
  title: string; // Human-readable Arabic description of action
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: AuditDiffMap;
  createdAt: string;
  updatedAt: string;
}

export interface AuditFilterParams {
  collection?: CollectionName | 'all';
  action?: AuditAction | 'all';
  onBehalfOnly?: boolean;
  search?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  enteredBy?: string;
}
