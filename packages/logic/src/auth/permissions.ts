/**
 * Badawi Fleet Platform - Roles & Granular Permissions
 * Ref: Vision §2-أ, ADR-013, ADR-015, ADR-032, ADR-039, ADR-046
 */

export type UserRole =
  | 'super_admin'
  | 'management'
  | 'mixer_manager'
  | 'garage_security'
  | 'driver'
  | 'site_manager';

export type PermissionKey =
  | 'report.view'
  | 'report.edit'
  | 'report.export'
  | 'period.close'
  | 'period.open'
  | 'adjustment.create'
  | 'adjustment.approve'
  | 'statement.mixer.create'
  | 'statement.garage.create'
  | 'statement.driver.create'
  | 'inquiry.reply'
  | 'inquiry.manage'
  | 'users.manage'
  | 'settings.manage'
  | 'petro.request'
  | 'audit.view'
  | 'import.upload';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'مسؤول الأسطول (Super Admin)',
  management: 'الإدارة والمالية (Management)',
  mixer_manager: 'مدير الخلاطة (Mixer Manager)',
  garage_security: 'أمن الجراج (Garage Security)',
  driver: 'سائق (Driver)',
  site_manager: 'مدير موقع (Site Manager)'
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'report.view': 'عرض التقارير',
  'report.edit': 'تعديل التقارير عبر Google Sheets',
  'report.export': 'تصدير بيانات المرتبات والـ CSV',
  'period.close': 'إغلاق وتجميد الفترات',
  'period.open': 'فتح الفترات المقفولة',
  'adjustment.create': 'إنشاء تسوية مرتبات',
  'adjustment.approve': 'اعتماد التسويات',
  'statement.mixer.create': 'إدخال بيان الخلاطة',
  'statement.garage.create': 'إدخال بيان الجراج والصيانة',
  'statement.driver.create': 'إدخال نقلات السائق',
  'inquiry.reply': 'الرد على الاستفسارات الموجهة',
  'inquiry.manage': 'إنشاء وإدارة الاستفسارات',
  'users.manage': 'إدارة المستخدمين والصلاحيات',
  'settings.manage': 'تعديل سجل الإعدادات',
  'petro.request': 'إدارة طلبات العهدة (Petro)',
  'audit.view': 'عرض سجل المراجعة والتدقيق',
  'import.upload': 'رفع ملفات Excel الخام'
};

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  super_admin: [
    'report.view',
    'report.edit',
    'report.export',
    'period.close',
    'period.open',
    'adjustment.create',
    'adjustment.approve',
    'statement.mixer.create',
    'statement.garage.create',
    'statement.driver.create',
    'inquiry.reply',
    'inquiry.manage',
    'users.manage',
    'settings.manage',
    'petro.request',
    'audit.view',
    'import.upload'
  ],
  management: [
    'report.view',
    'report.export',
    'audit.view'
  ],
  mixer_manager: [
    'statement.mixer.create',
    'inquiry.reply'
  ],
  garage_security: [
    'statement.garage.create',
    'inquiry.reply'
  ],
  driver: [
    'statement.driver.create',
    'inquiry.reply'
  ],
  site_manager: [
    'report.view'
  ]
};

export function hasPermission(
  role: UserRole,
  permission: PermissionKey,
  customOverrides?: { allow?: PermissionKey[]; deny?: PermissionKey[] }
): boolean {
  if (role === 'super_admin') return true;
  if (customOverrides?.deny?.includes(permission)) return false;
  if (customOverrides?.allow?.includes(permission)) return true;
  return ROLE_DEFAULT_PERMISSIONS[role]?.includes(permission) ?? false;
}