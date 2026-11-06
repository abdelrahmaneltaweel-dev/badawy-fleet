/**
 * Badawi Fleet Platform - Settings Lifecycle Manager
 * Draft, Live Preview, Versioned Publish, Audit Log & Rollback (ADR-040, ADR-044)
 */

import {
  SYSTEM_SETTINGS_REGISTRY,
  getDefaultSettings,
  type SettingDefinition
} from './registry.js';

export interface SettingsVersion {
  version: number;
  publishedAt: string;
  publishedBy: string;
  reason: string;
  data: Record<string, unknown>;
}

export interface SettingDiff {
  key: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  risk: 'cosmetic' | 'logical';
}

export class SettingsManager {
  private current: SettingsVersion;
  private draft: Record<string, unknown>;
  private history: SettingsVersion[];

  constructor(initialData?: Record<string, unknown>, initialHistory?: SettingsVersion[]) {
    const defaults = getDefaultSettings();
    this.current = {
      version: 1,
      publishedAt: new Date().toISOString(),
      publishedBy: 'system',
      reason: 'التهيئة الافتراضية الأولية للنظام',
      data: { ...defaults, ...(initialData || {}) }
    };
    this.draft = { ...this.current.data };
    this.history = initialHistory || [this.current];
  }

  getCurrentSettings(): Record<string, unknown> {
    return { ...this.current.data };
  }

  getDraftSettings(): Record<string, unknown> {
    return { ...this.draft };
  }

  getSettingValue<T = unknown>(key: string): T {
    return (this.draft[key] !== undefined ? this.draft[key] : this.current.data[key]) as T;
  }

  setDraftValue(key: string, value: unknown): { valid: boolean; error?: string } {
    const def = SYSTEM_SETTINGS_REGISTRY.find((s) => s.key === key);
    if (!def) {
      return { valid: false, error: 'إعداد غير معرف في السجل' };
    }

    if (def.validate) {
      const res = def.validate(value);
      if (!res.valid) return res;
    }

    this.draft[key] = value;
    return { valid: true };
  }

  hasDraftChanges(): boolean {
    return Object.keys(this.draft).some(
      (key) => JSON.stringify(this.draft[key]) !== JSON.stringify(this.current.data[key])
    );
  }

  getDiff(): SettingDiff[] {
    const diffs: SettingDiff[] = [];
    for (const def of SYSTEM_SETTINGS_REGISTRY) {
      const currentVal = this.current.data[def.key];
      const draftVal = this.draft[def.key];

      if (JSON.stringify(currentVal) !== JSON.stringify(draftVal)) {
        diffs.push({
          key: def.key,
          label: def.label,
          oldValue: currentVal,
          newValue: draftVal,
          risk: def.risk
        });
      }
    }
    return diffs;
  }

  publishDraft(publishedBy: string, reason = 'تحديث الإعدادات المنشور'): SettingsVersion {
    const newVersion: SettingsVersion = {
      version: this.current.version + 1,
      publishedAt: new Date().toISOString(),
      publishedBy: publishedBy || 'super_admin',
      reason: reason.trim() || 'تحديث الإعدادات',
      data: { ...this.draft }
    };

    this.history.unshift(newVersion);
    if (this.history.length > 20) {
      this.history.length = 20; // Keep last 20 published releases
    }

    this.current = newVersion;
    this.draft = { ...this.current.data };
    return newVersion;
  }

  discardDraft(): void {
    this.draft = { ...this.current.data };
  }

  rollbackToVersion(versionNumber: number, rolledBackBy: string): boolean {
    const target = this.history.find((h) => h.version === versionNumber);
    if (!target) return false;

    this.draft = { ...target.data };
    this.publishDraft(rolledBackBy, `استرجاع الإصدار رقم v${versionNumber}`);
    return true;
  }

  resetCategoryToDefaults(category: string): void {
    for (const def of SYSTEM_SETTINGS_REGISTRY) {
      if (def.category === category) {
        this.draft[def.key] = def.defaultValue;
      }
    }
  }

  getVersionHistory(): SettingsVersion[] {
    return [...this.history];
  }

  exportJSON(): string {
    return JSON.stringify(
      {
        version: this.current.version,
        publishedAt: this.current.publishedAt,
        settings: this.current.data
      },
      null,
      2
    );
  }

  importJSON(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      const incoming = parsed.settings || parsed;
      if (!incoming || typeof incoming !== 'object') {
        return { success: false, error: 'ملف JSON غير صالح' };
      }

      for (const def of SYSTEM_SETTINGS_REGISTRY) {
        if (incoming[def.key] !== undefined) {
          this.setDraftValue(def.key, incoming[def.key]);
        }
      }

      return { success: true };
    } catch {
      return { success: false, error: 'تعذر قراءة ملف JSON' };
    }
  }
}