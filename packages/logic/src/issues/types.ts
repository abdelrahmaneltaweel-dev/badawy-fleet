/**
 * Badawi Fleet Platform - GPS Issues Types & Interfaces
 * Ref: ADR-019 (المشاكل = مشاكل GPS فقط), ADR-011 (WhatsApp wa.me links), Vision §2-ج
 */

import type { IssueDocument, IssueStatus, IssueType } from '../schema/types.js';

export type { IssueDocument, IssueStatus, IssueType };

export interface IssueTransitionOptions {
  actor: string;
  actorRole?: string;
  notes?: string;
  timestamp?: string;
  onBehalfOf?: string | null;
}

export interface IssueContactInfo {
  driverName: string;
  driverPhone: string;
  telUrl: string;
  whatsAppUrl: string;
  whatsAppMessage: string;
}

export interface IssueLifecycleAuditPayload {
  issueId: string;
  vehicleId: string;
  previousStatus: IssueStatus;
  newStatus: IssueStatus;
  actor: string;
  notes?: string;
  onBehalfOf?: string | null;
}
