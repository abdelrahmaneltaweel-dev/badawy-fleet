/**
 * Badawi Fleet Platform - Firebase Web Client SDK Service
 * Real Firebase Authentication and Firestore DB connection (ADR-004, ADR-013)
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
  collection,
  getDocs,
  query,
  limit as fsLimit
} from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseId?: string;
}

const FIREBASE_CONFIG_STORAGE_KEY = 'badawi_firebase_config_v1';

// Default / Environment fallback config
function getInitialConfig(): FirebaseClientConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }

  // Check Vite environment variables
  const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;
  const envProjectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID;
  const envAuthDomain = (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      projectId: envProjectId,
      authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`
    };
  }

  return null;
}

let activeApp: FirebaseApp | null = null;
let activeAuth: Auth | null = null;
let activeDb: Firestore | null = null;
let currentConfig: FirebaseClientConfig | null = getInitialConfig();

export function initFirebase(config: FirebaseClientConfig): { app: FirebaseApp; auth: Auth; db: Firestore } {
  currentConfig = { ...config };
  try {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    activeApp = existingApps[0];
  } else {
    activeApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
      projectId: config.projectId,
      storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
      appId: config.appId
    });
  }

  activeAuth = getAuth(activeApp);
  activeDb = getFirestore(activeApp);

  return { app: activeApp, auth: activeAuth, db: activeDb };
}

// Auto-initialize if config exists
if (currentConfig && currentConfig.apiKey && currentConfig.projectId) {
  try {
    initFirebase(currentConfig);
  } catch (e) {
    console.warn('[Firebase] Auto-init failed:', e);
  }
}

export const firebaseService = {
  isConfigured(): boolean {
    return Boolean(currentConfig && currentConfig.apiKey && currentConfig.projectId);
  },

  getConfig(): FirebaseClientConfig | null {
    return currentConfig;
  },

  saveConfig(config: FirebaseClientConfig): { success: boolean; error?: string } {
    try {
      initFirebase(config);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  clearConfig() {
    currentConfig = null;
    activeApp = null;
    activeAuth = null;
    activeDb = null;
    try {
      localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },

  getAuth(): Auth | null {
    return activeAuth;
  },

  getDb(): Firestore | null {
    return activeDb;
  },

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    if (!activeDb || !currentConfig) {
      return { ok: false, message: 'لم يتم إدخال إعدادات Firebase (Project ID / API Key)', latencyMs: 0 };
    }

    try {
      // Test read from settings or vehicles
      const colRef = collection(activeDb, 'settings');
      const q = query(colRef, fsLimit(1));
      await getDocs(q);
      const latencyMs = Date.now() - start;
      return {
        ok: true,
        message: `تم الاتصال بنجاح بقاعدة بيانات Firestore (${currentConfig.projectId})`,
        latencyMs
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `فشل الاتصال بـ Firestore: ${msg}`,
        latencyMs
      };
    }
  }
};
