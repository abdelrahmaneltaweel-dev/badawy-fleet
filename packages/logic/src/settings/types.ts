/**
 * Badawi Fleet Platform - Settings Registry Types
 * Ref: ADR-040, ADR-044
 */

import type { PermissionKey } from '../auth/permissions.js';

export type SettingSection =
  | 'appearance'
  | 'motion'
  | 'navigation_dashboard'
  | 'analysis_rules'
  | 'periods_closing'
  | 'workflow_inquiries'
  | 'petro_wallet'
  | 'retention_lifecycle'
  | 'ingestion_sync';

export type SettingType = 'boolean' | 'number' | 'string' | 'select' | 'color';

export type RiskLevel = 'visual' | 'logical';

export interface SettingOption {
  value: string | number;
  label: string;
}

export interface SettingDefinition<T = unknown> {
  key: string;
  section: SettingSection;
  type: SettingType;
  label: string;
  description: string;
  defaultValue: T;
  riskLevel: RiskLevel;
  scope: 'global' | 'report' | 'role' | 'user';
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  requiredPermission?: PermissionKey;
}

export interface SettingsVersionRecord {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note?: string;
  values: Record<string, unknown>;
}

export interface SettingsState {
  version: number;
  lastUpdated: string;
  publishedBy: string;
  values: Record<string, unknown>;
}