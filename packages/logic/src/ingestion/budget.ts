/**
 * Badawi Fleet Platform - Spark Write Budget Calculator (T5.3)
 * Ref: ADR-004 (Firebase Spark 20,000 writes/day quota)
 * Ref: ADR-049 (Refresh Rate Write Guard & 90% Super Admin confirmation)
 * Ref: Vision §2-و, §2-ك (D-049)
 */

export const SPARK_DAILY_WRITE_LIMIT = 20000;
export const SPARK_WARNING_THRESHOLD_PERCENT = 70; // 14,000 writes
export const SPARK_CRITICAL_THRESHOLD_PERCENT = 90; // 18,000 writes
export const DEFAULT_FLEET_SIZE = 65;

export type WriteBudgetStatus = 'safe' | 'warning' | 'critical' | 'exceeded';

export interface WriteBudgetEstimate {
  intervalMinutes: number;
  runsPerDay: number;
  fleetSize: number;
  worstCaseWritesPerRun: number;
  worstCaseDailyWrites: number;
  worstCasePercentOfQuota: number;
  realisticWritesPerRun: number;
  realisticDailyWrites: number;
  realisticPercentOfQuota: number;
  status: WriteBudgetStatus;
  requiresSuperAdminConfirmation: boolean;
  messageArabic: string;
}

/**
 * Calculates the exact daily Firestore write consumption based on the ingestion refresh interval.
 *
 * Daily minutes = 1,440.
 * In worst-case scenario (peak day where every vehicle reports new activity):
 * Writes per run = fleetSize (daily summaries) + 1 (sync_state document)
 * Daily worst-case writes = runsPerDay * (fleetSize + 1)
 *
 * In realistic scenario with FNV-1a checksum diff check (ADR-004 / T5.2):
 * An average of ~25% of vehicles move/change per interval during typical operation.
 * Writes per run = Math.ceil(fleetSize * 0.25) + 1
 */
export function calculateWriteBudget(
  intervalMinutes: number,
  fleetSize: number = DEFAULT_FLEET_SIZE
): WriteBudgetEstimate {
  const safeInterval = Math.max(1, Math.round(Number(intervalMinutes) || 15));
  const safeFleet = Math.max(1, Math.round(Number(fleetSize) || DEFAULT_FLEET_SIZE));

  const runsPerDay = Math.floor(1440 / safeInterval);
  const worstCaseWritesPerRun = safeFleet + 1; // All vehicles changed + 1 sync_state doc
  const worstCaseDailyWrites = runsPerDay * worstCaseWritesPerRun;
  const worstCasePercentOfQuota = Number(((worstCaseDailyWrites / SPARK_DAILY_WRITE_LIMIT) * 100).toFixed(1));

  // Realistic case: diff check skips unchanged vehicles (saving 75%-85% writes)
  const realisticWritesPerRun = Math.ceil(safeFleet * 0.25) + 1;
  const realisticDailyWrites = runsPerDay * realisticWritesPerRun;
  const realisticPercentOfQuota = Number(((realisticDailyWrites / SPARK_DAILY_WRITE_LIMIT) * 100).toFixed(1));

  const requiresSuperAdminConfirmation = worstCasePercentOfQuota >= SPARK_CRITICAL_THRESHOLD_PERCENT;

  let status: WriteBudgetStatus = 'safe';
  let messageArabic = '';

  if (worstCasePercentOfQuota > 100) {
    status = 'exceeded';
    messageArabic = `خطر نفاد الحصة: هذا المعدل يستهلك ${worstCasePercentOfQuota}% من حصة Spark (${worstCaseDailyWrites} كتابة متوقعة يومياً تتجاوز الـ 20,000 المتاحة).`;
  } else if (worstCasePercentOfQuota >= SPARK_CRITICAL_THRESHOLD_PERCENT) {
    status = 'critical';
    messageArabic = `تحذير حرج (ADR-049): هذا المعدل يستهلك أكثر من 90% من حد الكتابات (${worstCaseDailyWrites} كتابة / ${worstCasePercentOfQuota}%). يتطلب تأكيداً صريحاً من الـ Super Admin.`;
  } else if (worstCasePercentOfQuota >= SPARK_WARNING_THRESHOLD_PERCENT) {
    status = 'warning';
    messageArabic = `تنبيه اقتراب (70%+): هذا المعدل يقترب من الحد المالي المجاني (${worstCaseDailyWrites} كتابة / ${worstCasePercentOfQuota}% في أسوأ الحالات).`;
  } else {
    status = 'safe';
    messageArabic = `معدل آمن ومستدام: استهلاك أقصى ${worstCaseDailyWrites} كتابة (${worstCasePercentOfQuota}% من حصة Spark)، والواقعي ~${realisticDailyWrites} كتابة (${realisticPercentOfQuota}%).`;
  }

  return {
    intervalMinutes: safeInterval,
    runsPerDay,
    fleetSize: safeFleet,
    worstCaseWritesPerRun,
    worstCaseDailyWrites,
    worstCasePercentOfQuota,
    realisticWritesPerRun,
    realisticDailyWrites,
    realisticPercentOfQuota,
    status,
    requiresSuperAdminConfirmation,
    messageArabic
  };
}
