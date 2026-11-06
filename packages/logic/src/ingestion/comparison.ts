/**
 * Badawi Fleet Platform — Data Source Comparison Engine
 * 
 * المرجع: docs/adr/ADR-048 (مقارنة عند عودة السحب)
 * يقارن بين الملخصات المستخرجة من سحب Traccar الآلي وتلك المستخرجة من رفع Excel الخام.
 * يحدد مستوى التطابق والفروق في النقلات والوقفات وأوقات الحركة.
 */

import type { DailySummaryDocument } from '../schema/types.js';

export type ComparisonMatchLevel = 'identical' | 'minor_diff' | 'major_diff';

export interface ComparisonFieldDiff {
  field: string;
  labelArabic: string;
  traccarValue: string | number | null;
  excelValue: string | number | null;
  isMatch: boolean;
  delta?: number;
  noteArabic?: string;
}

export interface SingleVehicleComparison {
  vehicleId: string;
  date: string;
  matchLevel: ComparisonMatchLevel;
  matchScorePercent: number;
  tripsDelta: number; // excel - traccar
  stopsDelta: number;
  fields: ComparisonFieldDiff[];
  hasMajorDiscrepancy: boolean;
  summaryArabic: string;
  traccarSummary?: DailySummaryDocument;
  excelSummary?: DailySummaryDocument;
}

export interface BatchComparisonResult {
  date: string;
  totalComparedVehicles: number;
  identicalCount: number;
  minorDiffCount: number;
  majorDiffCount: number;
  overallMatchRatePercent: number;
  vehicles: SingleVehicleComparison[];
  onlyInTraccar: string[];
  onlyInExcel: string[];
}

/**
 * مقارنة ملخصين لعربية واحدة في نفس اليوم
 */
export function compareSingleVehicleSummary(
  traccarSummary: DailySummaryDocument,
  excelSummary: DailySummaryDocument
): SingleVehicleComparison {
  const vehicleId = traccarSummary.vehicleId || excelSummary.vehicleId;
  const date = traccarSummary.date || excelSummary.date;
  const fields: ComparisonFieldDiff[] = [];

  // 1. فحص عدد النقلات / المشاوير (العنصر الجوهري)
  const tripsDelta = excelSummary.tripsCount - traccarSummary.tripsCount;
  const tripsMatch = tripsDelta === 0;
  fields.push({
    field: 'tripsCount',
    labelArabic: 'عدد النقلات',
    traccarValue: traccarSummary.tripsCount,
    excelValue: excelSummary.tripsCount,
    isMatch: tripsMatch,
    delta: tripsDelta,
    noteArabic: tripsMatch
      ? 'متطابق تماماً'
      : `فرق ${Math.abs(tripsDelta)} نقلة (${tripsDelta > 0 ? 'Excel أكثر' : 'Traccar أكثر'})`
  });

  // 2. فحص عدد الوقفات
  const stopsDelta = excelSummary.stopsCount - traccarSummary.stopsCount;
  const stopsMatch = stopsDelta === 0;
  fields.push({
    field: 'stopsCount',
    labelArabic: 'عدد الوقفات',
    traccarValue: traccarSummary.stopsCount,
    excelValue: excelSummary.stopsCount,
    isMatch: stopsMatch,
    delta: stopsDelta,
    noteArabic: stopsMatch
      ? 'متطابق تماماً'
      : `فرق ${Math.abs(stopsDelta)} وقفة`
  });

  // 3. فحص وقت أول حركة
  const firstMatch = traccarSummary.firstMovement === excelSummary.firstMovement;
  fields.push({
    field: 'firstMovement',
    labelArabic: 'بداية الحركة',
    traccarValue: traccarSummary.firstMovement,
    excelValue: excelSummary.firstMovement,
    isMatch: firstMatch,
    noteArabic: firstMatch ? 'متطابق' : 'اختلاف في توقيت أول إشارة'
  });

  // 4. فحص وقت آخر حركة
  const lastMatch = traccarSummary.lastMovement === excelSummary.lastMovement;
  fields.push({
    field: 'lastMovement',
    labelArabic: 'نهاية الحركة',
    traccarValue: traccarSummary.lastMovement,
    excelValue: excelSummary.lastMovement,
    isMatch: lastMatch,
    noteArabic: lastMatch ? 'متطابق' : 'اختلاف في توقيت آخر إشارة'
  });

  // 5. احتساب النتيجة ومستوى التطابق
  let matchLevel: ComparisonMatchLevel = 'identical';
  let hasMajorDiscrepancy = false;
  let summaryArabic = 'تطابق تام بنسبة 100% بين سحب Traccar ورفع Excel الخام.';

  if (!tripsMatch) {
    matchLevel = 'major_diff';
    hasMajorDiscrepancy = true;
    summaryArabic = `تنبيه: اختلاف في عدد النقلات (${traccarSummary.tripsCount} في Traccar مقابل ${excelSummary.tripsCount} في Excel). يتطلب مراجعة المشرف.`;
  } else if (!stopsMatch || !firstMatch || !lastMatch) {
    matchLevel = 'minor_diff';
    summaryArabic = 'تطابق في عدد النقلات مع فروق طفيفة في الوقفات أو توقيتات الحركة لا تؤثر على الحساب.';
  }

  // حساب نسبة التطابق المئوية
  const matchesCount = fields.filter(f => f.isMatch).length;
  const matchScorePercent = Math.round((matchesCount / fields.length) * 100);

  return {
    vehicleId,
    date,
    matchLevel,
    matchScorePercent,
    tripsDelta,
    stopsDelta,
    fields,
    hasMajorDiscrepancy,
    summaryArabic,
    traccarSummary,
    excelSummary
  };
}

/**
 * مقارنة مجمعة لكل أسطول العربيات ليوم محدد عند عودة سحب Traccar
 */
export function compareBatchDailySummaries(
  traccarSummaries: DailySummaryDocument[],
  excelSummaries: DailySummaryDocument[],
  operationalDate?: string
): BatchComparisonResult {
  const traccarMap = new Map<string, DailySummaryDocument>();
  for (const s of traccarSummaries) {
    traccarMap.set(s.vehicleId, s);
  }

  const excelMap = new Map<string, DailySummaryDocument>();
  for (const s of excelSummaries) {
    excelMap.set(s.vehicleId, s);
  }

  const allVehicleIds = Array.from(new Set([...traccarMap.keys(), ...excelMap.keys()]));
  allVehicleIds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const vehicles: SingleVehicleComparison[] = [];
  const onlyInTraccar: string[] = [];
  const onlyInExcel: string[] = [];

  let identicalCount = 0;
  let minorDiffCount = 0;
  let majorDiffCount = 0;

  for (const vId of allVehicleIds) {
    const tDoc = traccarMap.get(vId);
    const eDoc = excelMap.get(vId);

    if (tDoc && eDoc) {
      const comp = compareSingleVehicleSummary(tDoc, eDoc);
      vehicles.push(comp);
      if (comp.matchLevel === 'identical') identicalCount++;
      else if (comp.matchLevel === 'minor_diff') minorDiffCount++;
      else majorDiffCount++;
    } else if (tDoc && !eDoc) {
      onlyInTraccar.push(vId);
    } else if (!tDoc && eDoc) {
      onlyInExcel.push(vId);
    }
  }

  const totalCompared = vehicles.length;
  const overallMatchRate = totalCompared > 0
    ? Math.round(((identicalCount + (minorDiffCount * 0.8)) / totalCompared) * 100)
    : 100;

  const resolvedDate = operationalDate || 
    (vehicles[0]?.date || traccarSummaries[0]?.date || excelSummaries[0]?.date || '');

  return {
    date: resolvedDate,
    totalComparedVehicles: totalCompared,
    identicalCount,
    minorDiffCount,
    majorDiffCount,
    overallMatchRatePercent: overallMatchRate,
    vehicles,
    onlyInTraccar,
    onlyInExcel
  };
}
