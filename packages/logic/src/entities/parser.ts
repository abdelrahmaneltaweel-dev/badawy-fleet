/**
 * Badawi Fleet Platform - Excel / TSV Bulk Import Parser
 * Parses pasted table rows from Excel into validated vehicle candidates (ADR-047)
 */

import type { VehicleType } from '../schema/types.js';
import type { BulkImportParseResult, VehicleCandidate } from './types.js';

const VALID_TYPES: Record<string, VehicleType> = {
  tractor: 'tractor',
  جرار: 'tractor',
  truck: 'truck',
  نقل: 'truck',
  private: 'private',
  ملاكي: 'private'
};

const HEADER_KEYWORDS = ['رقم', 'كود', 'vehicle', 'id', 'العربية', 'عربية'];

export function parseVehiclesFromExcelPaste(rawText: string): BulkImportParseResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      candidates: [],
      summaryError: 'النص المنسوخ فارغ'
    };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const candidates: VehicleCandidate[] = [];
  const seenIds = new Set<string>();

  // Detect and skip header row if present (first column is header label, not a numeric ID)
  let startIndex = 0;
  const firstCol = lines[0].split(/\t|,/)[0].trim().toLowerCase();
  const isFirstColNumber = /^\d+$/.test(firstCol);
  const isHeaderFirstCol = HEADER_KEYWORDS.some((kw) => firstCol.includes(kw));

  if (!isFirstColNumber && isHeaderFirstCol) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    // Split by tab (Excel copy) or comma (CSV)
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    const cleanParts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ''));

    const vehicleId = cleanParts[0] || '';
    const name = cleanParts[1] || (vehicleId ? `عربية ${vehicleId}` : '');
    const plateNumber = cleanParts[2] || '';
    const rawType = (cleanParts[3] || 'tractor').toLowerCase();
    const gpsDeviceId = cleanParts[4] || null;
    const siteId = cleanParts[5] || null;

    const errors: string[] = [];

    // Validation 1: vehicleId
    if (!vehicleId) {
      errors.push('رقم العربية مفقود');
    } else if (seenIds.has(vehicleId)) {
      errors.push(`رقم العربية مكرر في الجدول (${vehicleId})`);
    } else {
      seenIds.add(vehicleId);
    }

    // Validation 2: Vehicle Type
    const mappedType = VALID_TYPES[rawType];
    if (!mappedType) {
      errors.push(`نوع العربية غير معروف: "${rawType}" (المسموح: جرار، نقل، ملاكي)`);
    }

    // Validation 3: Plate number
    if (!plateNumber) {
      errors.push('رقم اللوحة مطلوب');
    }

    candidates.push({
      vehicleId,
      name,
      plateNumber,
      type: mappedType || 'tractor',
      gpsDeviceId: gpsDeviceId || null,
      siteId: siteId || null,
      valid: errors.length === 0,
      errors
    });
  }

  const validCount = candidates.filter((c) => c.valid).length;
  const invalidCount = candidates.length - validCount;

  return {
    totalRows: candidates.length,
    validCount,
    invalidCount,
    candidates
  };
}