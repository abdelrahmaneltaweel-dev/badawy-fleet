/**
 * Badawi Fleet Platform — Analysis Configuration & Rules Registry Bridge
 * 
 * المرجع: docs/adr/ADR-015 (الإعدادات كبيانات أولاً), ADR-019, ADR-040, ADR-055
 * تحويل إعدادات المنصة المركزية إلى كائن AnalysisConfig المستخدم في خوارزميات الـ GPS
 * بدون أي ثوابت مدفونة، مع ربط كامل بـ rulesVersion.
 */

import type { AnalysisConfig } from './types.js';
import { DEFAULT_ANALYSIS_CONFIG } from './types.js';

/**
 * بناء AnalysisConfig متكامل من قيم سجل الإعدادات المركزي
 * مع تطبيق صمامات الأمان والحدود المسموحة والقيم الافتراضية
 */
export function buildAnalysisConfigFromSettings(
  settings: Record<string, unknown> = {}
): AnalysisConfig {
  const getNumber = (key: string, fallback: number, min?: number, max?: number): number => {
    const val = settings[key];
    if (typeof val === 'number' && !isNaN(val)) {
      if (min !== undefined && val < min) return min;
      if (max !== undefined && val > max) return max;
      return val;
    }
    return fallback;
  };

  const getString = (key: string, fallback: string): string => {
    const val = settings[key];
    return typeof val === 'string' && val.trim() ? val.trim() : fallback;
  };

  return {
    operationalDayStartHour: getNumber('trip_day_start_hour', DEFAULT_ANALYSIS_CONFIG.operationalDayStartHour, 0, 12),
    maxSpeedKmH: getNumber('max_speed_outlier_kmh', DEFAULT_ANALYSIS_CONFIG.maxSpeedKmH, 80, 200),
    maxTeleportSpeedKmH: getNumber('teleport_jump_threshold_kmh', DEFAULT_ANALYSIS_CONFIG.maxTeleportSpeedKmH, 100, 300),
    stopSpeedThreshold: getNumber('stop_speed_threshold_kmh', DEFAULT_ANALYSIS_CONFIG.stopSpeedThreshold, 1, 15),
    minStopDurationMinutes: getNumber('min_stop_duration_minutes', DEFAULT_ANALYSIS_CONFIG.minStopDurationMinutes, 2, 30),
    garageMaintenanceDurationMinutes: getNumber('garage_maintenance_min_minutes', DEFAULT_ANALYSIS_CONFIG.garageMaintenanceDurationMinutes, 5, 120),
    siteVisitDurationMinutes: getNumber('errand_min_stop_minutes', DEFAULT_ANALYSIS_CONFIG.siteVisitDurationMinutes, 3, 60),
    siteVisitRadiusMeters: getNumber('site_visit_radius_meters', DEFAULT_ANALYSIS_CONFIG.siteVisitRadiusMeters, 50, 1000),
    offlineThresholdMinutes: getNumber('gps_offline_threshold_minutes', DEFAULT_ANALYSIS_CONFIG.offlineThresholdMinutes, 15, 360),
    frozenSignalThresholdMinutes: getNumber('gps_frozen_signal_threshold_minutes', DEFAULT_ANALYSIS_CONFIG.frozenSignalThresholdMinutes, 10, 120),
    rulesVersion: getString('rules_version', DEFAULT_ANALYSIS_CONFIG.rulesVersion)
  };
}

/**
 * تحويل كائن AnalysisConfig إلى خريطة مفاتيح تطابق سجل الإعدادات SETTINGS_REGISTRY
 */
export function analysisConfigToSettingsMap(
  config: AnalysisConfig
): Record<string, unknown> {
  return {
    trip_day_start_hour: config.operationalDayStartHour,
    max_speed_outlier_kmh: config.maxSpeedKmH,
    teleport_jump_threshold_kmh: config.maxTeleportSpeedKmH,
    stop_speed_threshold_kmh: config.stopSpeedThreshold,
    min_stop_duration_minutes: config.minStopDurationMinutes,
    garage_maintenance_min_minutes: config.garageMaintenanceDurationMinutes,
    errand_min_stop_minutes: config.siteVisitDurationMinutes,
    site_visit_radius_meters: config.siteVisitRadiusMeters,
    gps_offline_threshold_minutes: config.offlineThresholdMinutes,
    gps_frozen_signal_threshold_minutes: config.frozenSignalThresholdMinutes,
    rules_version: config.rulesVersion
  };
}

/**
 * التحقق من صحة صيغة رقم إصدار القواعد SemVer (e.g. 1.0.0)
 */
export function isRulesVersionValid(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version.trim());
}
