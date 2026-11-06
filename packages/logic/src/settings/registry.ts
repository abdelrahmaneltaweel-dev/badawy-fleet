/**
 * Badawi Fleet Platform - Central Settings Registry
 * Ref: Vision §2-ك, ADR-040, ADR-041, ADR-044, ADR-049, ADR-055, ADR-056
 * Rule: Adding a new setting = A single definition line in this registry.
 */

import type { PermissionKey } from '../auth/permissions.js';

export type SettingType = 'string' | 'number' | 'boolean' | 'select' | 'color';
export type SettingCategory = 'appearance' | 'analysis_rules' | 'periods_sync' | 'petro_retention';
export type SettingRisk = 'cosmetic' | 'logical';

export interface SettingOption {
  value: string | number;
  label: string;
}

export interface SettingDefinition<T = unknown> {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  defaultValue: T;
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  risk: SettingRisk;
  permission: PermissionKey;
  affectsClosedPeriods: boolean;
  validate?: (val: T) => { valid: boolean; error?: string };
}

export const CATEGORY_LABELS: Record<SettingCategory, { title: string; icon: string }> = {
  appearance: { title: 'المظهر والحركة', icon: '🎨' },
  analysis_rules: { title: 'قواعد التحليل والأسطول', icon: '⚙️' },
  periods_sync: { title: 'الفترات وتكرار السحب', icon: '📅' },
  petro_retention: { title: 'العهدة والاحتفاظ بالبيانات', icon: '💳' }
};

export const SYSTEM_SETTINGS_REGISTRY: SettingDefinition[] = [
  // 1. Appearance & Motion (ADR-028, ADR-029)
  {
    key: 'appearance.theme',
    label: 'مظهر المنصة الافتراضي',
    description: 'النمط المعتمد للمنصة لجميع المستخدمين الجدد',
    category: 'appearance',
    type: 'select',
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: '🖥️ تلقائي حسب جهاز المستخدم' },
      { value: 'light', label: '☀️ الوضع الفاتح (Light)' },
      { value: 'dark', label: '🌙 الوضع الداكن (Dark)' }
    ],
    risk: 'cosmetic',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'appearance.fontFamily',
    label: 'الخط العربي المعتمد',
    description: 'الخط الافتراضي لواجهة وتصدير المنصة (ADR-058)',
    category: 'appearance',
    type: 'select',
    defaultValue: 'ibm_plex',
    options: [
      { value: 'ibm_plex', label: 'IBM Plex Sans Arabic (الافتراضي المعتمد)' },
      { value: 'tajawal', label: 'Tajawal' },
      { value: 'segoe', label: 'Segoe UI' },
      { value: 'system', label: 'خط النظام الافتراضي' }
    ],
    risk: 'cosmetic',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'motion.reduced',
    label: 'تقليل الحركة افتراضياً',
    description: 'إلغاء حركات الانتقال والتأثيرات لتوفير موارد الموبايل (ADR-028)',
    category: 'appearance',
    type: 'boolean',
    defaultValue: false,
    risk: 'cosmetic',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },

  // 2. Analysis Rules (ADR-016, ADR-019, Vision §2-ب)
  {
    key: 'rules.trip.minStopMinutes',
    label: 'الحد الأدنى لوقفة النقلة (دقيقة)',
    description: 'مدة التوقف داخل موقع التفريغ لاحتساب اكتمال النقلة للجرارات',
    category: 'analysis_rules',
    type: 'number',
    defaultValue: 20,
    min: 5,
    max: 120,
    unit: 'دقيقة',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false,
    validate: (val) => ({ valid: typeof val === 'number' && val >= 5, error: 'الحد الأدنى 5 دقائق' })
  },
  {
    key: 'rules.trip.siteRadiusMeters',
    label: 'نصف قطر النطاق الجغرافي للمواقع',
    description: 'المسافة بالمتر حول إحداثيات الموقع لاعتبار العربية دخلت الموقع',
    category: 'analysis_rules',
    type: 'number',
    defaultValue: 250,
    min: 50,
    max: 2000,
    unit: 'متر',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'rules.dayStartHour',
    label: 'ساعة بداية يوم التشغيل',
    description: 'الساعة التي يبدأ عندها احتساب نقلات ومشاوير اليوم الجديد (6 صباحاً)',
    category: 'analysis_rules',
    type: 'number',
    defaultValue: 6,
    min: 0,
    max: 23,
    unit: 'صباحاً',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'rules.standingAlertMinutes',
    label: 'تنبيه الوقوف خارج الموقع',
    description: 'مدة وقوف العربية خارج المواقع قبل ظهورها في بطاقة "واقفة +30د"',
    category: 'analysis_rules',
    type: 'number',
    defaultValue: 30,
    min: 10,
    max: 180,
    unit: 'دقيقة',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },

  // 3. Periods & Sync (ADR-041, ADR-049, ADR-055)
  {
    key: 'periods.cycleType',
    label: 'دورة تقرير المرتبات',
    description: 'تحديد نظام دورة الفترات الشهرية (ADR-041)',
    category: 'periods_sync',
    type: 'select',
    defaultValue: 'calendar_month',
    options: [
      { value: 'calendar_month', label: 'شهر تقويمي كامل (من 1 إلى آخر الشهر)' },
      { value: 'custom_day', label: 'دورة مخصصة بتحديد يوم بداية الشهر' }
    ],
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'periods.startDay',
    label: 'يوم بداية الدورة الشهرية',
    description: 'رقم اليوم في الشهر لبدء الدورة (مثال: 1 أو 26)',
    category: 'periods_sync',
    type: 'number',
    defaultValue: 1,
    min: 1,
    max: 28,
    unit: 'من الشهر',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'periods.autoFreezeOnClose',
    label: 'تجميد القيم تلقائياً عند إغلاق الفترة',
    description: 'أخذ لقطة نهائية غير قابلة للتعديل عند إغلاق الفترة لحماية المرتبات (ADR-036, ADR-038)',
    category: 'periods_sync',
    type: 'boolean',
    defaultValue: true,
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'sync.intervalMinutes',
    label: 'تكرار سحب Traccar الآلي (بالدقائق)',
    description: 'الفارق الزمني بين استدعاءات Worker مع حماية حد كتابات Spark (ADR-049)',
    category: 'periods_sync',
    type: 'select',
    defaultValue: 10,
    options: [
      { value: 5, label: 'كل 5 دقائق (أعلى دقة)' },
      { value: 10, label: 'كل 10 دقائق (الموصى به - متوازن جداً)' },
      { value: 15, label: 'كل 15 دقيقة (أقل استهلاكاً)' },
      { value: 30, label: 'كل 30 دقيقة' }
    ],
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },

  // 4. Petro & Retention (ADR-021, ADR-056)
  {
    key: 'petro.reorderThreshold',
    label: 'حد إعادة طلب العهدة (Petro)',
    description: 'ظهور تنبيه لطلب عهدة جديد عند انخفاض رصيد المحفظة عن هذا المبلغ',
    category: 'petro_retention',
    type: 'number',
    defaultValue: 25000,
    min: 5000,
    max: 100000,
    step: 1000,
    unit: 'ج.م',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'petro.creditLimit',
    label: 'الحد الأقصى لمحفظة العهدة',
    description: 'سقف رصيد محفظة الوقود المعتمد لشركة أبناء بدوي',
    category: 'petro_retention',
    type: 'number',
    defaultValue: 50000,
    min: 10000,
    max: 200000,
    step: 5000,
    unit: 'ج.م',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'retention.stopsMonths',
    label: 'مدة الاحتفاظ بتفاصيل الوقفات والأحداث',
    description: 'عدد الأشهر قبل تلخيص الوقفات وحذف التفاصيل القديمة (ADR-056)',
    category: 'petro_retention',
    type: 'number',
    defaultValue: 12,
    min: 3,
    max: 36,
    unit: 'شهر',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  },
  {
    key: 'retention.auditLogsMonths',
    label: 'مدة الاحتفاظ بسجل المراجعة (Audit Log)',
    description: 'فترة بقاء سجلات التعديلات والإدخال بالنيابة بالمنصة (ADR-056)',
    category: 'petro_retention',
    type: 'number',
    defaultValue: 24,
    min: 6,
    max: 60,
    unit: 'شهر',
    risk: 'logical',
    permission: 'settings.manage',
    affectsClosedPeriods: false
  }
];

/**
 * Returns default values dictionary for all registry entries
 */
export function getDefaultSettings(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const def of SYSTEM_SETTINGS_REGISTRY) {
    defaults[def.key] = def.defaultValue;
  }
  return defaults;
}

/**
 * Calculates estimated daily Firestore writes based on sync interval (ADR-049)
 * Firebase Spark Daily Write Quota: 20,000 writes/day
 */
export function calculateWriteQuotaImpact(syncIntervalMinutes: number, vehiclesCount = 65): {
  dailyRuns: number;
  estimatedWritesPerDay: number;
  quotaPercentage: number;
  safetyStatus: 'safe' | 'warning' | 'danger';
} {
  const dailyRuns = Math.round((24 * 60) / (syncIntervalMinutes || 10));
  // Estimated average document updates per sync run (only modified vehicles are written)
  const estimatedWritesPerRun = Math.min(vehiclesCount, 15);
  const estimatedWritesPerDay = dailyRuns * estimatedWritesPerRun;
  const quotaPercentage = Math.round((estimatedWritesPerDay / 20000) * 100);

  let safetyStatus: 'safe' | 'warning' | 'danger' = 'safe';
  if (quotaPercentage >= 90) safetyStatus = 'danger';
  else if (quotaPercentage >= 70) safetyStatus = 'warning';

  return {
    dailyRuns,
    estimatedWritesPerDay,
    quotaPercentage,
    safetyStatus
  };
}