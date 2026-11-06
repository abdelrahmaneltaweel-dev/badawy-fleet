/**
 * Badawi Fleet Platform - Central Settings Registry
 * Ref: Vision §2-ك, ADR-040, ADR-044, ADR-055, ADR-056, ADR-058
 */

import type { SettingDefinition, SettingSection } from './types.js';
import { calculateWriteBudget, type WriteBudgetEstimate } from '../ingestion/budget.js';

export const SETTING_SECTION_LABELS: Record<SettingSection, { label: string; icon: string }> = {
  appearance: { label: 'المظهر والعلامة التجارية', icon: '🎨' },
  motion: { label: 'الحركة وتجربة الاستخدام', icon: '⚡' },
  navigation_dashboard: { label: 'التنقل والداشبورد', icon: '📊' },
  analysis_rules: { label: 'قواعد التحليل والنقلات', icon: '⚙️' },
  periods_closing: { label: 'الفترات والإغلاق المالي', icon: '🔒' },
  workflow_inquiries: { label: 'سير العمل والاستفسارات', icon: '💬' },
  petro_wallet: { label: 'محفظة الوقود (Petro)', icon: '⛽' },
  retention_lifecycle: { label: 'الاحتفاظ وإدارة الموارد', icon: '🗄️' },
  ingestion_sync: { label: 'المزامنة والاستيعاب (Ingestion)', icon: '🔄' }
};

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  // 1. Appearance (المظهر)
  {
    key: 'theme_default_mode',
    section: 'appearance',
    type: 'select',
    label: 'النمط الافتراضي للنظام',
    description: 'المظهر العام للمنصة عند فتحها لأول مرة (فاتح أو داكن أو حسب نظام الجهاز)',
    defaultValue: 'auto',
    riskLevel: 'visual',
    scope: 'global',
    options: [
      { value: 'auto', label: '🖥️ تلقائي حسب نظام تشغيل الجهاز' },
      { value: 'light', label: '☀️ النمط الفاتح (Calm Light)' },
      { value: 'dark', label: '🌙 النمط الداكن (Dark)' }
    ]
  },
  {
    key: 'font_family_choice',
    section: 'appearance',
    type: 'select',
    label: 'الخط العربي المعتمد',
    description: 'الخط المستخدم في واجهة المنصة من القائمة المنتقاة مفتوحة الترخيص (ADR-045, ADR-058)',
    defaultValue: 'ibm_plex',
    riskLevel: 'visual',
    scope: 'global',
    options: [
      { value: 'ibm_plex', label: 'IBM Plex Sans Arabic (الافتراضي الرسمي)' },
      { value: 'tajawal', label: 'Tajawal' },
      { value: 'cairo', label: 'Cairo' },
      { value: 'noto_sans', label: 'Noto Sans Arabic' }
    ]
  },
  {
    key: 'base_font_size_px',
    section: 'appearance',
    type: 'number',
    label: 'حجم الخط الأساسي',
    description: 'الحجم المرجعي للنصوص بالبكسل مع تطبيق حد أمان لمنع النصوص غير المقروءة',
    defaultValue: 15,
    riskLevel: 'visual',
    scope: 'global',
    min: 13,
    max: 18,
    step: 1,
    unit: 'px'
  },

  // 2. Motion (الحركة) - ADR-028
  {
    key: 'motion_enabled',
    section: 'motion',
    type: 'boolean',
    label: 'تفعيل التأثيرات الحركية',
    description: 'تشغيل الانتقالات الانسيابية وتأثير التموج والنبض مع احترام تقليل الحركة التلقائي',
    defaultValue: true,
    riskLevel: 'visual',
    scope: 'global'
  },
  {
    key: 'motion_speed_factor',
    section: 'motion',
    type: 'select',
    label: 'سرعة الانتقالات والتفاعل',
    description: 'درجة استجابة وسرعة الحركات الدقيقة في الأزرار والنوافذ',
    defaultValue: 'normal',
    riskLevel: 'visual',
    scope: 'global',
    options: [
      { value: 'fast', label: 'سريعة (0.15 ثانية)' },
      { value: 'normal', label: 'هادئة متوازنة (0.25 ثانية)' },
      { value: 'slow', label: 'بطيئة ناعمة (0.4 ثانية)' }
    ]
  },

  // 3. Navigation & Dashboard (التنقل والداشبورد) - ADR-059
  {
    key: 'dashboard_show_wallet_card',
    section: 'navigation_dashboard',
    type: 'boolean',
    label: 'عرض بطاقة محفظة Petro في الداشبورد',
    description: 'إظهار رصيد ومؤشر محفظة الوقود في بطاقات الداشبورد الرئيسية',
    defaultValue: true,
    riskLevel: 'visual',
    scope: 'global'
  },
  {
    key: 'dashboard_auto_refresh_minutes',
    section: 'navigation_dashboard',
    type: 'number',
    label: 'معدل التحديث التلقائي للداشبورد',
    description: 'الفترة الفاصلة بالدقائق لتحديث بيانات الشاشة دون استنزاف حصة القراءات اليومية (ADR-049)',
    defaultValue: 15,
    riskLevel: 'logical',
    scope: 'global',
    min: 5,
    max: 60,
    step: 5,
    unit: 'دقيقة'
  },

  // 4. Analysis Rules (قواعد التحليل والنقلات) - Vision §3
  {
    key: 'trip_day_start_hour',
    section: 'analysis_rules',
    type: 'number',
    label: 'ساعة بداية يوم التشغيل',
    description: 'الساعة الصباحية المعتمدة لبداية دورة العمل اليومية (نظام 24 ساعة)',
    defaultValue: 6,
    riskLevel: 'logical',
    scope: 'global',
    min: 0,
    max: 12,
    step: 1,
    unit: 'ص'
  },
  {
    key: 'trip_crusher_min_stop_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'الحد الأدنى لوقفة التحميل بالكسارة',
    description: 'المدة الزمنية بالدقائق لاعتماد وقوف الجرار كنقطة تحميل رسمية بالنقلة',
    defaultValue: 5,
    riskLevel: 'logical',
    scope: 'global',
    min: 2,
    max: 30,
    step: 1,
    unit: 'دقيقة'
  },
  {
    key: 'trip_discharge_min_stop_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'الحد الأدنى لوقفة موقع التفريغ',
    description: 'المدة الزمنية بالدقائق لاعتماد نقطة التفريغ في مسار النقلة',
    defaultValue: 5,
    riskLevel: 'logical',
    scope: 'global',
    min: 2,
    max: 30,
    step: 1,
    unit: 'دقيقة'
  },
  {
    key: 'garage_maintenance_min_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'مدة وقوف صيانة الجراج',
    description: 'المدة بالدقائق داخل الجراج لاعتبار الوقوف صيانة أسطول دورية',
    defaultValue: 20,
    riskLevel: 'logical',
    scope: 'global',
    min: 10,
    max: 120,
    step: 5,
    unit: 'دقيقة'
  },
  {
    key: 'errand_min_stop_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'الحد الأدنى لوقفة المشوار (نقل وملاكي)',
    description: 'المدة بالدقائق لاعتماد زيارة موقع أو مشوار رسمي لعربيات النقل والملاكي',
    defaultValue: 10,
    riskLevel: 'logical',
    scope: 'global',
    min: 5,
    max: 60,
    step: 1,
    unit: 'دقيقة'
  },
  {
    key: 'standing_warning_threshold_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'حد تنبيه الوقوف الزائد خارج الموقع',
    description: 'المدة بالدقائق التي ترفع شارة تنبيه برتقالية لعربية متوقفة خارج المواقع المصرحة',
    defaultValue: 30,
    riskLevel: 'logical',
    scope: 'global',
    min: 15,
    max: 180,
    step: 5,
    unit: 'دقيقة'
  },
  {
    key: 'rules_version',
    section: 'analysis_rules',
    type: 'string',
    label: 'إصدار حزمة قواعد التحليل (rulesVersion)',
    description: 'رقم إصدار خوارزميات وقواعد التحليل المعتمدة في تقارير الأسطول (SemVer)',
    defaultValue: '1.0.0',
    riskLevel: 'logical',
    scope: 'global'
  },
  {
    key: 'stop_speed_threshold_kmh',
    section: 'analysis_rules',
    type: 'number',
    label: 'عتبة سرعة التوقف',
    description: 'السرعة التي يعتبر السير أقل منها أو مساوياً لها توقفاً',
    defaultValue: 3,
    riskLevel: 'logical',
    scope: 'global',
    min: 1,
    max: 10,
    step: 0.5,
    unit: 'كم/س'
  },
  {
    key: 'min_stop_duration_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'أدنى مدة لاعتماد وقفة عامة',
    description: 'المدة الزمنية بالدقائق لتسجيل الوقفة واحتسابها في مسار الأسطول',
    defaultValue: 5,
    riskLevel: 'logical',
    scope: 'global',
    min: 2,
    max: 30,
    step: 1,
    unit: 'دقيقة'
  },
  {
    key: 'max_speed_outlier_kmh',
    section: 'analysis_rules',
    type: 'number',
    label: 'حد السرعة الشاذة (Outlier Filter)',
    description: 'أقصى سرعة مقبولة للأسطول يتم حذف أي نقطة إشارة تسجل أعلى منها',
    defaultValue: 140,
    riskLevel: 'logical',
    scope: 'global',
    min: 100,
    max: 200,
    step: 5,
    unit: 'كم/س'
  },
  {
    key: 'teleport_jump_threshold_kmh',
    section: 'analysis_rules',
    type: 'number',
    label: 'حد قفزات الإشارة المستحيلة (Teleport)',
    description: 'السرعة المستنتجة بين نقطتين متتاليتين التي تدل على تشوش GPS لحظي وقفزة مستحيلة',
    defaultValue: 180,
    riskLevel: 'logical',
    scope: 'global',
    min: 120,
    max: 300,
    step: 10,
    unit: 'كم/س'
  },
  {
    key: 'site_visit_radius_meters',
    section: 'analysis_rules',
    type: 'number',
    label: 'نصف قطر دائرة موقع العمل',
    description: 'نطاق الموقع الجغرافي بالأمتار لاعتماد وقفة زيارة مشوار عمل رسمي',
    defaultValue: 250,
    riskLevel: 'logical',
    scope: 'global',
    min: 50,
    max: 1000,
    step: 25,
    unit: 'متر'
  },
  {
    key: 'gps_offline_threshold_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'مهلة انقطاع الـ GPS (Offline)',
    description: 'المدة بالدقائق دون وصول إشارة لاعتبار الجهاز منقطعاً وفتح مشكلة متابعة تلقائية (ADR-019)',
    defaultValue: 60,
    riskLevel: 'logical',
    scope: 'global',
    min: 15,
    max: 360,
    step: 15,
    unit: 'دقيقة'
  },
  {
    key: 'gps_frozen_signal_threshold_minutes',
    section: 'analysis_rules',
    type: 'number',
    label: 'مهلة تجمد الإشارة (Frozen Signal)',
    description: 'المدة بالدقائق لثبات الإحداثيات تماماً مع تشغيل المحرك لاعتبار الإشارة متجمدة',
    defaultValue: 30,
    riskLevel: 'logical',
    scope: 'global',
    min: 10,
    max: 120,
    step: 5,
    unit: 'دقيقة'
  },

  // 5. Periods & Closing (الفترات والإغلاق المالي) - ADR-036, ADR-041, ADR-042
  {
    key: 'period_cycle_type',
    section: 'periods_closing',
    type: 'select',
    label: 'دورة تقرير المرتبات الدورية',
    description: 'طريقة حساب الفترة الزمنية للمرتبات والتقارير المالية (ADR-041)',
    defaultValue: 'calendar_month',
    riskLevel: 'logical',
    scope: 'global',
    options: [
      { value: 'calendar_month', label: '📅 شهر تقويمي كامل (من 1 إلى نهاية الشهر)' },
      { value: 'cut_off_25', label: '✂️ دورة قطع شهرية (من يوم 26 إلى يوم 25)' }
    ]
  },
  {
    key: 'period_freeze_on_close',
    section: 'periods_closing',
    type: 'boolean',
    label: 'تجميد القيم نهائياً عند إغلاق الفترة',
    description: 'توليد لقطة بيانات مجمّدة غير قابلة للتغيير للمرتبات والتقارير عند إغلاقها (ADR-038)',
    defaultValue: true,
    riskLevel: 'logical',
    scope: 'global'
  },
  {
    key: 'adjustments_auto_carry_forward',
    section: 'periods_closing',
    type: 'boolean',
    label: 'ترحيل التسويات المتأخرة للفترة المفتوحة تلقائياً',
    description: 'إضافة فروق الفترات المقفولة تلقائياً كبند تسوية في كشف أول فترة مفتوحة تالية (ADR-042)',
    defaultValue: true,
    riskLevel: 'logical',
    scope: 'global'
  },

  // 6. Workflow & Inquiries (سير العمل والاستفسارات) - ADR-017, ADR-050
  {
    key: 'driver_trip_submission_enabled',
    section: 'workflow_inquiries',
    type: 'boolean',
    label: 'السماح للسائق بتسجيل نقلاته ذاتياً من الموبايل',
    description: 'تمكين السائق من تسجيل الخروج والعودة كبيان مساند للمطابقة (ADR-060)',
    defaultValue: true,
    riskLevel: 'logical',
    scope: 'global'
  },
  {
    key: 'driver_submission_deadline_hours',
    section: 'workflow_inquiries',
    type: 'number',
    label: 'مهلة تعديل السائق لنقلاته المسجلة',
    description: 'الحد الأقصى بالساعات المتاح للسائق لتعديل أو تصحيح بيانات نقلته المسجلة',
    defaultValue: 24,
    riskLevel: 'logical',
    scope: 'global',
    min: 1,
    max: 72,
    step: 1,
    unit: 'ساعة'
  },

  // 7. Petro Wallet (محفظة الوقود) - ADR-021
  {
    key: 'petro_wallet_credit_limit',
    section: 'petro_wallet',
    type: 'number',
    label: 'الحد الائتماني لمحفظة الوقود',
    description: 'سقف الرصيد الكلي لمحفظة Petro الخاصة بالأسطول',
    defaultValue: 50000,
    riskLevel: 'logical',
    scope: 'global',
    min: 10000,
    max: 200000,
    step: 5000,
    unit: 'ج.م'
  },
  {
    key: 'petro_wallet_reorder_threshold',
    section: 'petro_wallet',
    type: 'number',
    label: 'حد إعادة طلب العهدة',
    description: 'إظهار شارة تنبيه حمراء عند وصول رصيد المحفظة لهذا الحد للبدء في طلب عهدة جديدة',
    defaultValue: 25000,
    riskLevel: 'logical',
    scope: 'global',
    min: 5000,
    max: 40000,
    step: 2500,
    unit: 'ج.م'
  },

  // 8. Retention & Lifecycle (الاحتفاظ وإدارة الموارد) - ADR-056
  {
    key: 'retention_stops_months',
    section: 'retention_lifecycle',
    type: 'number',
    label: 'فترة الاحتفاظ بتفاصيل الوقفات والأحداث',
    description: 'المدة بالشهور للاحتفاظ بتفاصيل الوقفات قبل تلخيصها شهرياً لحماية سعة 1GB على Spark',
    defaultValue: 12,
    riskLevel: 'logical',
    scope: 'global',
    min: 3,
    max: 36,
    step: 1,
    unit: 'شهر'
  },
  {
    key: 'retention_audit_logs_months',
    section: 'retention_lifecycle',
    type: 'number',
    label: 'فترة الاحتفاظ بسجل المراجعة والتعديلات',
    description: 'المدة بالشهور للاحتفاظ بسجل تدقيق العمليات (Audit Logs)',
    defaultValue: 24,
    riskLevel: 'logical',
    scope: 'global',
    min: 6,
    max: 60,
    step: 6,
    unit: 'شهر'
  },

  // 9. Ingestion & Sync (المزامنة والاستيعاب) - ADR-004, ADR-049
  {
    key: 'ingestion.refresh_interval_minutes',
    section: 'ingestion_sync',
    type: 'number',
    label: 'معدل سحب وتحديث بيانات الأسطول (Traccar Ingestion)',
    description: 'الفترة الفاصلة بالدقائق بين عمليات سحب GPS وتحليل الأسطول التلقائية مع حماية ميزانية الـ 20,000 كتابة (ADR-049)',
    defaultValue: 15,
    riskLevel: 'logical',
    scope: 'global',
    min: 1,
    max: 180,
    step: 1,
    unit: 'دقيقة'
  }
];

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  // Support both dot notation and underscore notation
  const normalizedKey = key === 'ingestion_refresh_interval_minutes' ? 'ingestion.refresh_interval_minutes' : key;
  return SETTINGS_REGISTRY.find((s) => s.key === normalizedKey);
}

export function getDefaultSettingsMap(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const item of SETTINGS_REGISTRY) {
    result[item.key] = item.defaultValue;
  }
  return result;
}

export interface SettingValidationResult {
  valid: boolean;
  error?: string;
  requiresSuperAdminConfirmation?: boolean;
  budget?: WriteBudgetEstimate;
}

export function validateSettingValue(
  key: string,
  value: unknown,
  options?: { superAdminConfirmed?: boolean; fleetSize?: number }
): SettingValidationResult {
  const def = getSettingDefinition(key);
  if (!def) {
    return { valid: false, error: 'إعداد غير معرف في السجل' };
  }

  if (def.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { valid: false, error: 'القيمة يجب أن تكون نعم أو لا (boolean)' };
    }
  } else if (def.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: 'القيمة يجب أن تكون رقماً' };
    }
    if (def.min !== undefined && num < def.min) {
      return { valid: false, error: `الحد الأدنى المسموح به هو ${def.min}` };
    }
    if (def.max !== undefined && num > def.max) {
      return { valid: false, error: `الحد الأقصى المسموح به هو ${def.max}` };
    }

    // Special Guard for Ingestion Refresh Rate (ADR-049 & D-049)
    if (def.key === 'ingestion.refresh_interval_minutes') {
      const budget = calculateWriteBudget(num, options?.fleetSize);
      if (budget.requiresSuperAdminConfirmation && !options?.superAdminConfirmed) {
        return {
          valid: false,
          error: `تنبيه حرج (ADR-049): هذا المعدل يستهلك أكثر من 90% (${budget.worstCaseDailyWrites} كتابة / ${budget.worstCasePercentOfQuota}%) من حصة الـ 20,000 كتابة اليومية. يتطلب تأكيداً صريحاً من الـ Super Admin للمتابعة.`,
          requiresSuperAdminConfirmation: true,
          budget
        };
      }
      return { valid: true, budget };
    }
  } else if (def.type === 'select') {
    if (def.options && !def.options.some((opt) => opt.value === value)) {
      return { valid: false, error: 'القيمة المختارة غير صالحة من ضمن الخيارات المتاحة' };
    }
  }

  return { valid: true };
}