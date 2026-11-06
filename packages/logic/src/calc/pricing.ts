/**
 * Badawi Fleet Platform - Effective-Dated Pricing Engine
 * Ref: D-051 (الأسعار التقديرية والنهائية بتواريخ سريان / Effective-Dated Pricing)
 * Ref: ADR-057 (حساب الأجر = نقلات × سعر من جدول تاريخي / Price Lookup)
 */

import type { PriceEntry, PriceTable } from './types.js';

/**
 * Searches a price table for the exact rate applicable on a specific calendar date (YYYY-MM-DD).
 * Follows specificity priority: exact itemKey match > generic category match.
 * Resolves to the most recently effective rate if multiple rules match.
 */
export function lookupPrice(
  table: PriceTable | undefined,
  category: string,
  date: string,
  itemKey?: string
): number | null {
  if (!table || !table.entries || table.entries.length === 0) {
    return null;
  }

  const cleanDate = (date || '').slice(0, 10);
  const targetCategory = (category || '').trim().toLowerCase();
  const targetItemKey = (itemKey || '').trim().toLowerCase();

  // Filter entries that match category and the effective date window
  const activeEntries = table.entries.filter((entry) => {
    const entryCategory = (entry.category || '').trim().toLowerCase();
    if (entryCategory !== targetCategory && entryCategory !== '*') {
      return false;
    }

    const from = entry.effectiveFrom ? entry.effectiveFrom.slice(0, 10) : '1970-01-01';
    const to = entry.effectiveTo ? entry.effectiveTo.slice(0, 10) : '9999-12-31';

    if (cleanDate < from || cleanDate > to) {
      return false;
    }

    return true;
  });

  if (activeEntries.length === 0) {
    return null;
  }

  // 1. Try matching with exact itemKey first (e.g. route code, specific site or vehicle)
  if (targetItemKey) {
    const specificMatches = activeEntries.filter(
      (e) => e.itemKey && e.itemKey.trim().toLowerCase() === targetItemKey
    );
    if (specificMatches.length > 0) {
      // Pick the most recent effectiveFrom
      specificMatches.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      return specificMatches[0].rate;
    }
  }

  // 2. Fallback to generic category rate (where itemKey is null or empty)
  const genericMatches = activeEntries.filter((e) => !e.itemKey || e.itemKey.trim() === '');
  if (genericMatches.length > 0) {
    genericMatches.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return genericMatches[0].rate;
  }

  // 3. Fallback to any remaining active match
  activeEntries.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return activeEntries[0].rate;
}

/**
 * Creates the standard baseline price table for the platform (ADR-041, ADR-051).
 */
export function createDefaultPriceTable(): PriceTable {
  return {
    version: 1,
    entries: [
      {
        id: 'tractor_base_2026',
        category: 'tractor',
        rate: 160,
        effectiveFrom: '2026-01-01',
        description: 'سعر نقلة الجرار الأساسي لعام 2026'
      },
      {
        id: 'truck_base_2026',
        category: 'truck',
        rate: 120,
        effectiveFrom: '2026-01-01',
        description: 'أجر مشوار عربيات النقل'
      },
      {
        id: 'private_base_2026',
        category: 'private',
        rate: 80,
        effectiveFrom: '2026-01-01',
        description: 'أجر مشوار سيارات الملاكي'
      }
    ]
  };
}

/**
 * Validates price table structure and ensures dates are formatted in standard YYYY-MM-DD.
 */
export function validatePriceTable(table: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!table || typeof table !== 'object') {
    return { valid: false, errors: ['Price table must be a non-null object'] };
  }

  if (typeof table.version !== 'number') {
    errors.push('Price table version must be a valid number');
  }

  if (!Array.isArray(table.entries)) {
    errors.push('Price table entries must be an array');
    return { valid: false, errors };
  }

  (table.entries as PriceEntry[]).forEach((entry: PriceEntry, index: number) => {
    if (!entry.id) errors.push(`Entry #${index} missing unique id`);
    if (!entry.category) errors.push(`Entry #${index} missing category`);
    if (typeof entry.rate !== 'number' || isNaN(entry.rate) || entry.rate < 0) {
      errors.push(`Entry #${index} has invalid rate: ${entry.rate}`);
    }
    if (!entry.effectiveFrom || !/^\d{4}-\d{2}-\d{2}/.test(entry.effectiveFrom)) {
      errors.push(`Entry #${index} has invalid effectiveFrom date: ${entry.effectiveFrom}`);
    }
    if (entry.effectiveTo && !/^\d{4}-\d{2}-\d{2}/.test(entry.effectiveTo)) {
      errors.push(`Entry #${index} has invalid effectiveTo date: ${entry.effectiveTo}`);
    }
    if (entry.effectiveTo && entry.effectiveFrom && entry.effectiveTo < entry.effectiveFrom) {
      errors.push(`Entry #${index} effectiveTo cannot be earlier than effectiveFrom`);
    }
  });

  return { valid: errors.length === 0, errors };
}
