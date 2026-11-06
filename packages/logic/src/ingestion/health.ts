/**
 * Badawi Fleet Platform - Ingestion Sync Health Evaluator (T5.4)
 * Ref: ADR-004, ADR-005, ADR-023, ADR-049
 * Ref: Vision §2-و, §2-ك
 */

import type { SyncStateDocument } from './types.js';

export type SyncHealthStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

export interface SyncHealthEvaluation {
  status: SyncHealthStatus;
  minutesSinceLastRun: number;
  minutesSinceLastPing: number;
  isStale: boolean;
  labelArabic: string;
  detailArabic: string;
  colorVar: string;
  badgeBgVar: string;
  stats?: {
    lastDurationMs: number;
    vehiclesTotal: number;
    writesExecuted: number;
    writesSkipped: number;
    errorsCount: number;
  };
}

/**
 * Evaluates the real-time operational health of the Traccar Ingestion Worker (GitHub Actions cron).
 *
 * Thresholds:
 * - Healthy: Last successful worker run <= refreshInterval * 1.5 (e.g. within 22 mins for 15-min interval)
 * - Degraded: Last run > refreshInterval * 1.5 and <= refreshInterval * 3 (e.g. runner delayed or queued)
 * - Error: Last run > refreshInterval * 3 or syncState.health === 'error' (e.g. workflow failure, server down)
 */
export function evaluateSyncHealth(
  syncState: SyncStateDocument | null | undefined,
  refreshIntervalMinutes: number = 15,
  referenceNow: Date | string = new Date()
): SyncHealthEvaluation {
  if (!syncState) {
    return {
      status: 'unknown',
      minutesSinceLastRun: -1,
      minutesSinceLastPing: -1,
      isStale: true,
      labelArabic: 'لم يبدأ السحب بعد',
      detailArabic: 'لا توجد بيانات مزامنة سابقة مسجلة في المستودع',
      colorVar: 'var(--mute)',
      badgeBgVar: 'var(--soft)'
    };
  }

  const nowMs = typeof referenceNow === 'string' ? new Date(referenceNow).getTime() : referenceNow.getTime();
  const runMs = new Date(syncState.lastRunAt).getTime();
  const pingMs = syncState.lastSyncTime ? new Date(syncState.lastSyncTime).getTime() : runMs;

  const diffRunMs = Math.max(0, nowMs - runMs);
  const diffPingMs = Math.max(0, nowMs - pingMs);

  const minutesSinceLastRun = Math.round(diffRunMs / (60 * 1000));
  const minutesSinceLastPing = Math.round(diffPingMs / (60 * 1000));

  const safeInterval = Math.max(1, refreshIntervalMinutes);
  const degradedThreshold = Math.round(safeInterval * 1.5);
  const errorThreshold = Math.round(safeInterval * 3);

  // If worker reported explicit error
  if (syncState.health === 'error') {
    return {
      status: 'error',
      minutesSinceLastRun,
      minutesSinceLastPing,
      isStale: true,
      labelArabic: `تعطل السحب (${minutesSinceLastRun} دقيقة)`,
      detailArabic: syncState.errorMessage || 'حدث خطأ أثناء تشغيل عملية السحب الأخيرة',
      colorVar: 'var(--bad)',
      badgeBgVar: 'var(--bad-soft)',
      stats: syncState.stats
    };
  }

  // Time-based lag detection
  if (minutesSinceLastRun > errorThreshold) {
    return {
      status: 'error',
      minutesSinceLastRun,
      minutesSinceLastPing,
      isStale: true,
      labelArabic: `متوقف منذ ${minutesSinceLastRun} دقيقة`,
      detailArabic: `تجاوز السحب مهلة الطوارئ (${errorThreshold} دقيقة). يرجى فحص GitHub Actions runner.`,
      colorVar: 'var(--bad)',
      badgeBgVar: 'var(--bad-soft)',
      stats: syncState.stats
    };
  }

  if (minutesSinceLastRun > degradedThreshold || syncState.health === 'degraded') {
    return {
      status: 'degraded',
      minutesSinceLastRun,
      minutesSinceLastPing,
      isStale: true,
      labelArabic: `متأخر (${minutesSinceLastRun} دقيقة)`,
      detailArabic: `تأخرت المزامنة المجدولة (المعدل المطلوب كل ${safeInterval} دقيقة).`,
      colorVar: 'var(--warn)',
      badgeBgVar: 'var(--warn-soft)',
      stats: syncState.stats
    };
  }

  // Healthy
  const timeLabel = minutesSinceLastRun === 0 ? 'الآن' : `منذ ${minutesSinceLastRun} دقيقة`;
  return {
    status: 'healthy',
    minutesSinceLastRun,
    minutesSinceLastPing,
    isStale: false,
    labelArabic: `متزامن (${timeLabel})`,
    detailArabic: `آخر سحب ناجح لـ ${syncState.stats?.vehiclesTotal || 65} عربية، وتم توفير ${syncState.stats?.writesSkipped || 0} كتابة.`,
    colorVar: 'var(--ok)',
    badgeBgVar: 'var(--ok-soft)',
    stats: syncState.stats
  };
}
