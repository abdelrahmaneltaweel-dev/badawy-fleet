/**
 * Badawi Fleet Platform - Settings Service
 * Manages drafts, live previews, publishing with versions, history rollback, and export/import (ADR-040, ADR-044)
 */

import {
  type SettingsState,
  type SettingsVersionRecord,
  getDefaultSettingsMap,
  validateSettingValue
} from '@badawi/logic';

const PUBLISHED_SETTINGS_KEY = 'badawi_settings_published_v1';
const DRAFT_SETTINGS_KEY = 'badawi_settings_draft_v1';
const SETTINGS_HISTORY_KEY = 'badawi_settings_history_v1';

export type SettingsListener = (state: SettingsState) => void;
const listeners = new Set<SettingsListener>();

function loadPublished(): SettingsState {
  try {
    const raw = localStorage.getItem(PUBLISHED_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return {
    version: 1,
    lastUpdated: '2026-10-01T08:00:00Z',
    publishedBy: 'مسؤول الأسطول',
    values: getDefaultSettingsMap()
  };
}

function loadDraft(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(DRAFT_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return null;
}

function loadHistory(): SettingsVersionRecord[] {
  try {
    const raw = localStorage.getItem(SETTINGS_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

let currentState: SettingsState = loadPublished();
let currentDraft: Record<string, unknown> | null = loadDraft();

function notify() {
  listeners.forEach((fn) => fn(currentState));
}

export const settingsService = {
  getSettings(): SettingsState {
    return currentState;
  },

  getEffectiveValues(): Record<string, unknown> {
    return currentDraft ? { ...currentState.values, ...currentDraft } : currentState.values;
  },

  getValue<T>(key: string): T {
    const values = this.getEffectiveValues();
    return (values[key] ?? getDefaultSettingsMap()[key]) as T;
  },

  hasDraft(): boolean {
    return currentDraft !== null && Object.keys(currentDraft).length > 0;
  },

  getDraftValues(): Record<string, unknown> {
    return currentDraft ? { ...currentDraft } : {};
  },

  updateDraftValue(key: string, value: unknown): { valid: boolean; error?: string } {
    const validation = validateSettingValue(key, value);
    if (!validation.valid) {
      return validation;
    }

    if (!currentDraft) {
      currentDraft = {};
    }
    currentDraft[key] = value;

    try {
      localStorage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(currentDraft));
    } catch {
      // Ignore
    }

    notify();
    return { valid: true };
  },

  discardDraft() {
    currentDraft = null;
    try {
      localStorage.removeItem(DRAFT_SETTINGS_KEY);
    } catch {
      // Ignore
    }
    notify();
  },

  publish(publishedBy = 'Super Admin', note = ''): SettingsState {
    const effectiveValues = this.getEffectiveValues();
    const newVersion = currentState.version + 1;
    const now = new Date().toISOString();

    // Record in history before updating
    const history = loadHistory();
    history.unshift({
      version: currentState.version,
      publishedAt: currentState.lastUpdated,
      publishedBy: currentState.publishedBy,
      note: note || undefined,
      values: currentState.values
    });

    if (history.length > 20) {
      history.length = 20;
    }

    try {
      localStorage.setItem(SETTINGS_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }

    currentState = {
      version: newVersion,
      lastUpdated: now,
      publishedBy,
      values: effectiveValues
    };

    try {
      localStorage.setItem(PUBLISHED_SETTINGS_KEY, JSON.stringify(currentState));
      localStorage.removeItem(DRAFT_SETTINGS_KEY);
    } catch {
      // Ignore
    }

    currentDraft = null;
    notify();
    return currentState;
  },

  rollback(targetVersion: number): boolean {
    const history = loadHistory();
    const found = history.find((h) => h.version === targetVersion);
    if (!found) return false;

    // Put current in history
    history.unshift({
      version: currentState.version,
      publishedAt: currentState.lastUpdated,
      publishedBy: currentState.publishedBy,
      note: 'تم التراجع من هذا الإصدار',
      values: currentState.values
    });

    currentState = {
      version: targetVersion,
      lastUpdated: new Date().toISOString(),
      publishedBy: `استرجاع الإصدار v${targetVersion}`,
      values: found.values
    };

    try {
      localStorage.setItem(PUBLISHED_SETTINGS_KEY, JSON.stringify(currentState));
      localStorage.setItem(SETTINGS_HISTORY_KEY, JSON.stringify(history));
      localStorage.removeItem(DRAFT_SETTINGS_KEY);
    } catch {
      // Ignore
    }

    currentDraft = null;
    notify();
    return true;
  },

  getHistory(): SettingsVersionRecord[] {
    return loadHistory();
  },

  resetToDefault() {
    this.discardDraft();
    const defaults = getDefaultSettingsMap();
    currentState = {
      version: currentState.version + 1,
      lastUpdated: new Date().toISOString(),
      publishedBy: 'إعادة ضبط للافتراضي',
      values: defaults
    };
    try {
      localStorage.setItem(PUBLISHED_SETTINGS_KEY, JSON.stringify(currentState));
    } catch {
      // Ignore
    }
    notify();
  },

  exportJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: currentState.version,
        values: this.getEffectiveValues()
      },
      null,
      2
    );
  },

  importJSON(jsonString: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object' || !parsed.values) {
        return { success: false, message: 'صيغة ملف غير صالحة' };
      }

      currentDraft = { ...parsed.values };
      try {
        localStorage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(currentDraft));
      } catch {
        // Ignore
      }
      notify();
      return { success: true, message: 'تم استيراد الإعدادات كمسودة، اضغط "نشر" لاعتمادها' };
    } catch {
      return { success: false, message: 'فشلت قراءة ملف JSON' };
    }
  },

  subscribe(listener: SettingsListener): () => void {
    listeners.add(listener);
    listener(currentState);
    return () => listeners.delete(listener);
  }
};