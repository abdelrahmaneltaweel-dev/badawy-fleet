/**
 * Badawi Fleet Platform — Raw Excel & CSV Parser for Traccar GPS Data
 * 
 * المرجع: docs/adr/ADR-048 (مصدر البيانات: سحب Traccar وبديله رفع Excel الخام)
 * Spike: S-10 (فحص معالجة Excel الخام لـ 65 عربية في المتصفح)
 * 
 * يقرأ ملفات Traccar المصدرة (XLSX عبر مصفوفة خلايا أو CSV/TSV كنص)
 * ويشغّل نفس طبقة logic تماماً في المتصفح والـ Node.js
 * ويسم المستندات الناتجة بـ dataSource: 'excel'.
 */

import type { RawGpsPoint, Geofence, AnalysisConfig } from '../analysis/types.js';
import { analyzeVehicleDailyData, type VehicleAnalysisInput } from '../analysis/pipeline.js';
import { convertAnalysisToDailySummary } from './syncManager.js';
import type { DailySummaryDocument } from '../schema/types.js';

export interface ColumnIndexMap {
  vehicleId: number;
  time: number;
  latitude: number;
  longitude: number;
  speed: number;
  course?: number;
  valid?: number;
  address?: number;
}

export interface ExcelIngestionResult {
  totalRows: number;
  validPointsCount: number;
  vehiclesCount: number;
  vehicleSummaries: Record<string, DailySummaryDocument>;
  summariesList: DailySummaryDocument[];
  operationalDates: string[];
  warnings: string[];
  processingTimeMs: number;
}

/**
 * دالة مساعدة لتجزئة أسطر CSV مع التعامل مع علامات التنصيص والفواصل المختلفة
 */
export function parseCsvToRows(csvContent: string, delimiter?: string): (string | number | boolean | null)[][] {
  if (!csvContent || !csvContent.trim()) {
    return [];
  }

  // الكشف التلقائي عن الفاصل إذا لم يحدد (فاصلة أو فاصلة منقوطة أو Tab)
  let sep = delimiter;
  if (!sep) {
    const firstLine = csvContent.split(/\r?\n/)[0] || '';
    if (firstLine.includes('\t')) sep = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) sep = ';';
    else sep = ',';
  }

  const rows: (string | number | boolean | null)[][] = [];
  const lines = csvContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const row: (string | number | boolean | null)[] = [];
    let inQuotes = false;
    let currentCell = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // تخطي علامة التنصيص المزدوجة
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === sep && !inQuotes) {
        row.push(coerceCellValue(currentCell.trim()));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(coerceCellValue(currentCell.trim()));
    rows.push(row);
  }

  return rows;
}

function coerceCellValue(raw: string): string | number | boolean | null {
  if (raw === '' || raw === 'null' || raw === 'NULL') return null;
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;

  // فحص إذا كان رقماً صحيحاً أو عشرياً (وليس تاريخاً بصيغة 2026-10-30)
  if (!raw.includes('-') && !raw.includes(':') && !raw.includes('/')) {
    const num = Number(raw);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  return raw;
}

/**
 * تحديد خريطة الأعمدة من صف الترويسة (Header Row)
 */
export function detectColumnIndices(headerRow: (string | number | boolean | Date | null | undefined)[]): ColumnIndexMap | null {
  const norm = headerRow.map(cell => (cell ? String(cell).trim().toLowerCase() : ''));

  let vehicleId = -1;
  let time = -1;
  let latitude = -1;
  let longitude = -1;
  let speed = -1;
  let course = -1;
  let valid = -1;
  let address = -1;

  for (let i = 0; i < norm.length; i++) {
    const col = norm[i];
    if (vehicleId === -1 && (
      col === 'deviceid' || col === 'device_id' || col === 'vehicleid' || col === 'vehicle_id' ||
      col === 'id' || col.includes('عربية') || col.includes('جهاز') || col === 'device'
    )) {
      vehicleId = i;
    } else if (time === -1 && (
      col === 'time' || col === 'fixtime' || col === 'devicetime' || col === 'servertime' ||
      col === 'timestamp' || col === 'date' || col.includes('وقت') || col.includes('تاريخ')
    )) {
      time = i;
    } else if (latitude === -1 && (
      col === 'latitude' || col === 'lat' || col === 'y' || col.includes('عرض')
    )) {
      latitude = i;
    } else if (longitude === -1 && (
      col === 'longitude' || col === 'lon' || col === 'lng' || col === 'x' || col.includes('طول')
    )) {
      longitude = i;
    } else if (speed === -1 && (
      col === 'speed' || col === 'spd' || col.includes('سرعة')
    )) {
      speed = i;
    } else if (course === -1 && (
      col === 'course' || col === 'heading' || col === 'bearing' || col.includes('اتجاه')
    )) {
      course = i;
    } else if (valid === -1 && (
      col === 'valid' || col === 'is_valid'
    )) {
      valid = i;
    } else if (address === -1 && (
      col === 'address' || col === 'addr' || col.includes('عنوان') || col.includes('موقع')
    )) {
      address = i;
    }
  }

  // إذا لم نجد الترويسات بالاسم، نجرب ترتيب Traccar الافتراضي القياسي (Spike S-10):
  // [DeviceId, DeviceName, Time, Valid, Latitude, Longitude, Speed, Course, Address]
  if (vehicleId === -1 || time === -1 || latitude === -1 || longitude === -1) {
    if (norm.length >= 7) {
      return {
        vehicleId: 0,
        time: 2,
        valid: 3,
        latitude: 4,
        longitude: 5,
        speed: 6,
        course: 7,
        address: 8
      };
    }
    return null;
  }

  return {
    vehicleId,
    time,
    latitude,
    longitude,
    speed: speed !== -1 ? speed : -1,
    course: course !== -1 ? course : undefined,
    valid: valid !== -1 ? valid : undefined,
    address: address !== -1 ? address : undefined
  };
}

/**
 * تحليل مصفوفة الصفوف المأخوذة من Excel أو CSV وتجميعها لكل عربية
 */
export function parseRawGpsPointsFromRows(
  rows: (string | number | boolean | Date | null | undefined)[][]
): { pointsByVehicle: Map<string, RawGpsPoint[]>; totalRows: number; skippedRows: number } {
  if (rows.length === 0) {
    return { pointsByVehicle: new Map(), totalRows: 0, skippedRows: 0 };
  }

  const colMap = detectColumnIndices(rows[0]);
  if (!colMap) {
    throw new Error('تعذر التعرف على أعمدة ملف Traccar. يرجى التأكد من وجود أعمدة (DeviceId, Time, Latitude, Longitude)');
  }

  const pointsByVehicle = new Map<string, RawGpsPoint[]>();
  let skippedRows = 0;

  // نبدأ من الصف الثاني (تخطي الترويسة)
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) {
      skippedRows++;
      continue;
    }

    const rawVehId = row[colMap.vehicleId];
    if (rawVehId === null || rawVehId === undefined || String(rawVehId).trim() === '') {
      skippedRows++;
      continue;
    }
    const vehicleId = String(rawVehId).trim();

    // فحص صحة الإشارة إن وجد عمود Valid
    if (colMap.valid !== undefined && row[colMap.valid] === false) {
      skippedRows++;
      continue;
    }

    // استخراج الإحداثيات
    const rawLat = Number(row[colMap.latitude]);
    const rawLon = Number(row[colMap.longitude]);
    if (isNaN(rawLat) || isNaN(rawLon) || (rawLat === 0 && rawLon === 0)) {
      skippedRows++;
      continue;
    }

    // استخراج الوقت
    const rawTime = row[colMap.time];
    let timestamp = '';
    if (rawTime && typeof rawTime === 'object' && (rawTime as unknown) instanceof Date) {
      timestamp = (rawTime as Date).toISOString();
    } else if (typeof rawTime === 'string') {
      const parsedD = new Date(rawTime);
      timestamp = !isNaN(parsedD.getTime()) ? parsedD.toISOString() : rawTime;
    } else if (typeof rawTime === 'number') {
      // توقيت unix ms أو Excel serial
      const parsedD = new Date(rawTime);
      timestamp = !isNaN(parsedD.getTime()) ? parsedD.toISOString() : new Date().toISOString();
    }

    if (!timestamp) {
      skippedRows++;
      continue;
    }

    // استخراج السرعة
    let speed = 0;
    if (colMap.speed !== -1 && row[colMap.speed] !== undefined && row[colMap.speed] !== null) {
      const parsedSpeed = Number(row[colMap.speed]);
      if (!isNaN(parsedSpeed)) speed = parsedSpeed;
    }

    const point: RawGpsPoint = {
      vehicleId,
      latitude: rawLat,
      longitude: rawLon,
      timestamp,
      speed: Math.round(speed * 10) / 10
    };

    if (colMap.course !== undefined && row[colMap.course] !== undefined) {
      const parsedCourse = Number(row[colMap.course]);
      if (!isNaN(parsedCourse)) point.course = parsedCourse;
    }

    let list = pointsByVehicle.get(vehicleId);
    if (!list) {
      list = [];
      pointsByVehicle.set(vehicleId, list);
    }
    list.push(point);
  }

  // ترتيب نقاط كل عربية ترتيباً زمنياً تصاعدياً
  for (const [vId, points] of pointsByVehicle.entries()) {
    points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    pointsByVehicle.set(vId, points);
  }

  return {
    pointsByVehicle,
    totalRows: rows.length - 1,
    skippedRows
  };
}

/**
 * المعالج الشامل: يحلل ملف Excel أو CSV بالكامل باستخدام نفس محرك logic
 * ويسم النتائج بـ dataSource: 'excel' (ADR-048).
 */
export function processRawGpsInput(options: {
  rows?: (string | number | boolean | Date | null | undefined)[][];
  csvText?: string;
  vehiclesMap?: Record<string, VehicleAnalysisInput>;
  geofences?: Geofence[];
  operationalDate?: string;
  customConfig?: Partial<AnalysisConfig>;
}): ExcelIngestionResult {
  const startTime = Date.now();
  const warnings: string[] = [];

  let rows = options.rows;
  if (!rows && options.csvText) {
    rows = parseCsvToRows(options.csvText);
  }

  if (!rows || rows.length === 0) {
    return {
      totalRows: 0,
      validPointsCount: 0,
      vehiclesCount: 0,
      vehicleSummaries: {},
      summariesList: [],
      operationalDates: [],
      warnings: ['الملف فارغ أو لا يحتوي على صفوف صالحة'],
      processingTimeMs: Date.now() - startTime
    };
  }

  const { pointsByVehicle, totalRows, skippedRows } = parseRawGpsPointsFromRows(rows);
  if (skippedRows > 0) {
    warnings.push(`تم تخطي ${skippedRows} صفاً لعدم اكتمال بيانات الإحداثيات أو معرف العربية.`);
  }

  const vehicleSummaries: Record<string, DailySummaryDocument> = {};
  const summariesList: DailySummaryDocument[] = [];
  const datesSet = new Set<string>();
  let validPointsCount = 0;

  for (const [vehicleId, points] of pointsByVehicle.entries()) {
    validPointsCount += points.length;
    if (points.length === 0) continue;

    // استخراج أو افتراض تعريف العربية (الافتراضي جرار tractor بحسب أسطول بدوي)
    const vehicleInput: VehicleAnalysisInput = options.vehiclesMap?.[vehicleId] || {
      id: vehicleId,
      type: 'tractor',
      name: `عربية ${vehicleId}`
    };

    // تشغيل نفس الـ pipeline الموحد تماماً
    const analysis = analyzeVehicleDailyData(
      vehicleInput,
      points,
      options.geofences || [],
      options.operationalDate,
      new Date(),
      options.customConfig
    );

    // التحويل لـ DailySummaryDocument مع الوسم الصريح بـ dataSource: 'excel' (ADR-048)
    const summary = convertAnalysisToDailySummary(analysis, null, 'excel');

    vehicleSummaries[vehicleId] = summary;
    summariesList.push(summary);
    datesSet.add(summary.date);
  }

  return {
    totalRows,
    validPointsCount,
    vehiclesCount: pointsByVehicle.size,
    vehicleSummaries,
    summariesList,
    operationalDates: Array.from(datesSet),
    warnings,
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * مولّد بيانات Traccar محاكاة لاختبار الأداء والتحقق الفوري بنقرة واحدة (Spike S-10)
 */
export function generateSyntheticTraccarRows(
  vehicleCount: number = 65,
  pointsPerVehicle: number = 100,
  dateString: string = '2026-10-30'
): (string | number | boolean)[][] {
  const rows: (string | number | boolean)[][] = [];
  
  // Header
  rows.push(['DeviceId', 'DeviceName', 'Time', 'Valid', 'Latitude', 'Longitude', 'Speed', 'Course', 'Address']);

  for (let v = 1; v <= vehicleCount; v++) {
    const vehId = (100 + v).toString();
    const vehName = `عربية ${vehId}`;
    
    for (let p = 0; p < pointsPerVehicle; p++) {
      const hour = 6 + Math.floor(p / 15);
      const minute = (p * 4) % 60;
      const timeStr = `${dateString}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
      
      // مسار حقيقي متحرك مع وقفات تشغيلية
      const lat = 31.1234 + (v * 0.001) + (p * 0.0001);
      const lon = 29.8765 + (v * 0.001) + (p * 0.0001);
      const speed = p % 10 === 0 ? 0 : 42.5;

      rows.push([
        vehId,
        vehName,
        timeStr,
        true,
        lat,
        lon,
        speed,
        180,
        'محور التعمير - الإسكندرية'
      ]);
    }
  }

  return rows;
}
