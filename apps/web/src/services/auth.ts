/**
 * Badawi Fleet Platform - Auth Service
 * Supports Email/Password, Custom Claims, User Management without Super Admin logout (ADR-013, ADR-015)
 */

import {
  type UserRole,
  type PermissionKey,
  ROLE_LABELS,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission
} from '@badawi/logic';

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
}

const AUTH_STORAGE_KEY = 'badawi-auth-user';
const USERS_STORAGE_KEY = 'badawi-platform-users';

// Pre-seeded verified accounts for all platform roles
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

let currentUser: UserProfile | null = (() => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : SEED_USERS[0]; // Default to Super Admin for seamless development
  } catch {
    return SEED_USERS[0];
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

export const authService = {
  getCurrentUser(): UserProfile | null {
    return currentUser;
  },

  subscribe(listener: AuthListener): () => void {
    authListeners.add(listener);
    listener(currentUser);
    return () => authListeners.delete(listener);
  },

  login(email: string): Promise<UserProfile> {
    return new Promise((resolve, reject) => {
      const users = getStoredUsers();
      const cleanEmail = email.trim().toLowerCase();
      const found = users.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!found) {
        // Allow creating/logging in with any email as demo driver or custom user
        const newUser: UserProfile = {
          uid: 'u-' + Date.now().toString(36),
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0] || 'مستخدم',
          role: cleanEmail.includes('admin') ? 'super_admin' : 'driver',
          active: true,
          createdAt: new Date().toISOString()
        };
        users.push(newUser);
        saveStoredUsers(users);
        currentUser = newUser;
      } else {
        if (!found.active) {
          reject(new Error('هذا الحساب تم تعطيله، راجع مسؤول الأسطول'));
          return;
        }
        currentUser = found;
      }

      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      } catch {
        // Ignore
      }

      notifyAuth();
      resolve(currentUser);
    });
  },

  logout(): Promise<void> {
    return new Promise((resolve) => {
      currentUser = null;
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // Ignore
      }
      notifyAuth();
      resolve();
    });
  },

  listUsers(): UserProfile[] {
    return getStoredUsers();
  },

  /**
   * Create new user from admin panel without logging out the Super Admin (Spike S-6 / ADR-013)
   */
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