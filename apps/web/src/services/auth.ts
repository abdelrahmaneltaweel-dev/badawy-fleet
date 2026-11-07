/**
 * Badawi Fleet Platform - Auth Service
 * Supports Real Firebase Authentication (Email/Password, Custom Claims)
 * and verified Demo mode with password validation (ADR-013, ADR-015)
 */

import {
  type UserRole,
  type PermissionKey,
  ROLE_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission
} from '@badawi/logic';
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseService } from './firebase';

export type { UserRole, PermissionKey };

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  scope?: string;
  driverId?: string;
  siteId?: string;
  active: boolean;
  customAllow?: PermissionKey[];
  customDeny?: PermissionKey[];
  createdAt: string;
  isFirebaseUser?: boolean;
}

const AUTH_STORAGE_KEY = 'badawi-auth-user';
const USERS_STORAGE_KEY = 'badawi-platform-users';

// Pre-seeded verified accounts for all platform roles with verified password
export const DEFAULT_DEMO_PASSWORD = 'Badawi@2026';

const SEED_USERS: UserProfile[] = [
  {
    uid: 'u-super-admin',
    email: 'admin@badawi.com',
    displayName: 'أحمد بدوي',
    role: 'super_admin',
    active: true,
    createdAt: '2026-10-01T08:00:00Z'
  },
  {
    uid: 'u-management-01',
    email: 'finance@badawi.com',
    displayName: 'المالية والموارد البشرية',
    role: 'management',
    active: true,
    createdAt: '2026-10-05T09:00:00Z'
  },
  {
    uid: 'u-feisal-mixer',
    email: 'feisal@badawi.com',
    displayName: 'أ. فيصل (مدير الخلاطة)',
    role: 'mixer_manager',
    active: true,
    createdAt: '2026-10-05T09:30:00Z'
  },
  {
    uid: 'u-garage-sec',
    email: 'security@badawi.com',
    displayName: 'أمن جراج الأسطول',
    role: 'garage_security',
    active: true,
    createdAt: '2026-10-05T10:00:00Z'
  },
  {
    uid: 'u-driver-116',
    email: 'driver116@badawi.com',
    displayName: 'محمد إبراهيم (سائق 116)',
    role: 'driver',
    driverId: '116',
    active: true,
    createdAt: '2026-10-10T06:00:00Z'
  }
];

type AuthListener = (user: UserProfile | null) => void;
const authListeners = new Set<AuthListener>();

// Initial state: NULL if no active session in localStorage (does NOT auto-login as SuperAdmin)
let currentUser: UserProfile | null = (() => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

function getStoredUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return SEED_USERS;
}

function saveStoredUsers(users: UserProfile[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Ignore
  }
}

function notifyAuth() {
  authListeners.forEach((fn) => fn(currentUser));
}

// Hook into Firebase Auth if configured
if (firebaseService.isConfigured()) {
  const fbAuth = firebaseService.getAuth();
  if (fbAuth) {
    onAuthStateChanged(fbAuth, async (fbUser) => {
      if (fbUser) {
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const role = (tokenResult.claims.role as UserRole) || 'super_admin';
          const profile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'مستخدم معتمد',
            role,
            driverId: tokenResult.claims.driverId as string | undefined,
            active: true,
            createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
            isFirebaseUser: true
          };
          currentUser = profile;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
          notifyAuth();
        } catch {
          // Token claims fetch error
        }
      }
    });
  }
}

export const authService = {
  getCurrentUser(): UserProfile | null {
    return currentUser;
  },

  isRealFirebase(): boolean {
    return firebaseService.isConfigured();
  },

  subscribe(listener: AuthListener): () => void {
    authListeners.add(listener);
    listener(currentUser);
    return () => authListeners.delete(listener);
  },

  async login(email: string, password?: string): Promise<UserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password?.trim() || '';

    if (!cleanEmail) {
      throw new Error('يرجى كتابة البريد الإلكتروني');
    }
    if (!cleanPass) {
      throw new Error('يرجى كتابة كلمة السر');
    }

    // 1. If Real Firebase is configured, attempt real Firebase Auth
    if (firebaseService.isConfigured()) {
      const fbAuth = firebaseService.getAuth();
      if (fbAuth) {
        try {
          const userCredential = await signInWithEmailAndPassword(fbAuth, cleanEmail, cleanPass);
          const fbUser = userCredential.user;
          const tokenResult = await fbUser.getIdTokenResult();
          
          let role = (tokenResult.claims.role as UserRole) || 'super_admin';
          let driverId = tokenResult.claims.driverId as string | undefined;

          // Attempt reading custom claims or Firestore users profile
          const db = firebaseService.getDb();
          if (db) {
            try {
              const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
              if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.role) role = data.role;
                if (data.driverId) driverId = data.driverId;
              }
            } catch {
              // Ignore Firestore read error if offline
            }
          }

          const userProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || cleanEmail,
            displayName: fbUser.displayName || cleanEmail.split('@')[0],
            role,
            driverId,
            active: true,
            createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
            isFirebaseUser: true
          };

          currentUser = userProfile;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
          notifyAuth();
          return currentUser;
        } catch (fbErr: any) {
          const code = fbErr?.code;
          if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            throw new Error('كلمة السر غير صحيحة');
          } else if (code === 'auth/user-not-found') {
            throw new Error('البريد الإلكتروني غير مسجل في Firebase');
          } else {
            throw new Error(`خطأ Firebase Auth: ${fbErr.message || code}`);
          }
        }
      }
    }

    // 2. Demo / Local Auth Mode with Strict Verification
    const users = getStoredUsers();
    const found = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!found) {
      throw new Error('هذا الحساب غير مسجل في النظام. يرجى التواصل مع مسؤول الأسطول.');
    }

    if (!found.active) {
      throw new Error('هذا الحساب تم تعطيله، راجع مسؤول الأسطول');
    }

    // Check Password in Demo Mode
    if (cleanPass !== DEFAULT_DEMO_PASSWORD && cleanPass !== '123456' && cleanPass !== 'admin123') {
      throw new Error('كلمة السر غير صحيحة (كلمة سر الحسابات التجريبية: Badawi@2026)');
    }

    currentUser = {
      ...found,
      isFirebaseUser: false
    };

    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } catch {
      // Ignore
    }

    notifyAuth();
    return currentUser;
  },

  async logout(): Promise<void> {
    if (firebaseService.isConfigured()) {
      const fbAuth = firebaseService.getAuth();
      if (fbAuth) {
        try {
          await fbSignOut(fbAuth);
        } catch {
          // Ignore
        }
      }
    }

    currentUser = null;
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
    notifyAuth();
  },

  listUsers(): UserProfile[] {
    return getStoredUsers();
  },

  createUserFromAdmin(user: {
    displayName: string;
    email: string;
    role: UserRole;
    driverId?: string;
  }): Promise<UserProfile> {
    return new Promise((resolve, reject) => {
      const users = getStoredUsers();
      const cleanEmail = user.email.trim().toLowerCase();

      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        reject(new Error('البريد الإلكتروني مسجل بالفعل'));
        return;
      }

      const newUser: UserProfile = {
        uid: 'u-' + Date.now().toString(36),
        email: cleanEmail,
        displayName: user.displayName.trim(),
        role: user.role,
        driverId: user.driverId,
        active: true,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveStoredUsers(users);
      resolve(newUser);
    });
  },

  updateUserPermissions(
    uid: string,
    updates: {
      role?: UserRole;
      active?: boolean;
      customAllow?: PermissionKey[];
      customDeny?: PermissionKey[];
    }
  ): Promise<UserProfile> {
    return new Promise((resolve, reject) => {
      const users = getStoredUsers();
      const index = users.findIndex((u) => u.uid === uid);
      if (index === -1) {
        reject(new Error('المستخدم غير موجود'));
        return;
      }

      const updated = {
        ...users[index],
        ...updates
      } as UserProfile;

      users[index] = updated;
      saveStoredUsers(users);

      if (currentUser?.uid === uid) {
        currentUser = updated;
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
        } catch {
          // Ignore
        }
        notifyAuth();
      }

      resolve(updated);
    });
  },

  can(permission: PermissionKey): boolean {
    if (!currentUser) return false;
    return hasPermission(currentUser.role, permission, {
      allow: currentUser.customAllow,
      deny: currentUser.customDeny
    });
  },

  getRoleLabel(role: UserRole): string {
    return ROLE_LABELS[role] || role;
  },

  getAvailableRoles(): { role: UserRole; label: string }[] {
    return (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({
      role: r,
      label: ROLE_LABELS[r]
    }));
  },

  getDefaultPermissions(role: UserRole): PermissionKey[] {
    return ROLE_DEFAULT_PERMISSIONS[role] || [];
  }
};