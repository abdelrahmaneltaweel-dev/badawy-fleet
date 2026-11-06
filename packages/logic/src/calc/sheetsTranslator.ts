/**
 * Badawi Fleet Platform - Google Sheets In-Row Formula Translator
 * Ref: ADR-057 (ترجمة صيغ Sheets البسيطة داخل الصف فقط / Translate In-Row Sheets Formulas)
 * Ref: D-057, D-031 (End Editing Review Window)
 */

import type { SheetsFormulaTranslationResult } from './types.js';
import { parse } from './parser.js';

export interface ColumnMapping {
  // Maps sheet column letters (A, B, C...) or indices to data field names
  [colLetter: string]: string;
}

/**
 * Translates simple in-row Google Sheets formulas into safe internal formula expressions.
 * Rule (ADR-057): Translates in-row formulas only. Cross-row formulas (e.g. SUM(A1:A10), A1+A2)
 * or cross-sheet references (Sheet2!A2) are safely flagged as unsupported.
 */
export function translateSheetsFormula(
  sheetsFormula: string,
  currentRowIndex: number, // 1-based row index (e.g. 2 for A2)
  columnMap: ColumnMapping
): SheetsFormulaTranslationResult {
  const trimmed = (sheetsFormula || '').trim();

  if (!trimmed.startsWith('=')) {
    return {
      translatedFormula: trimmed,
      isSupported: true
    };
  }

  // 1. Check for cross-sheet references (e.g. 'Sheet 1'!A2 or Sheet2!A2)
  if (trimmed.includes('!')) {
    return {
      translatedFormula: null,
      isSupported: false,
      reason: 'Cross-sheet formulas are not supported; evaluated to raw static value per ADR-057.'
    };
  }

  // 2. Check for multi-cell ranges (e.g. A2:B10)
  if (/:[A-Za-z]+[0-9]+/.test(trimmed)) {
    return {
      translatedFormula: null,
      isSupported: false,
      reason: 'Range formulas spanning multiple rows are not supported in calculated columns.'
    };
  }

  // 3. Find all cell references like A2, $B$2, C2, AA2, etc.
  // Regex matches optional $ followed by column letters followed by optional $ followed by row digits
  const cellRefRegex = /\$?([A-Za-z]+)\$?([0-9]+)/g;
  let match: RegExpExecArray | null;
  let isCrossRow = false;

  const foundReferences: Array<{ raw: string; col: string; row: number }> = [];

  while ((match = cellRefRegex.exec(trimmed)) !== null) {
    const raw = match[0];
    const col = match[1].toUpperCase();
    const row = parseInt(match[2], 10);

    foundReferences.push({ raw, col, row });

    // Validate that the reference is within the exact same row
    if (row !== currentRowIndex) {
      isCrossRow = true;
    }
  }

  if (isCrossRow) {
    return {
      translatedFormula: null,
      isSupported: false,
      reason: `Formula references rows other than row ${currentRowIndex}. Only in-row formulas are supported (ADR-057).`
    };
  }

  // 4. Replace cell references with normalized column names
  let translated = trimmed.slice(1); // remove leading '='

  // Sort by length descending to prevent sub-string collision (e.g. AA2 before A2)
  foundReferences.sort((a, b) => b.raw.length - a.raw.length);

  for (const ref of foundReferences) {
    const fieldName = columnMap[ref.col] || columnMap[ref.col.toLowerCase()] || ref.col;
    // Replace whole cell ref
    const escaped = ref.raw.replace(/\$/g, '\\$');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    translated = translated.replace(regex, `[${fieldName}]`);
  }

  // 5. Replace European/Arabic semicolons in function calls with standard commas
  translated = translated.replace(/;/g, ',');

  // 6. Validate that the translated formula is syntax-valid for our safe parser
  try {
    parse(translated);
    return {
      translatedFormula: translated,
      isSupported: true
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      translatedFormula: null,
      isSupported: false,
      reason: `Formula syntax could not be safely parsed: ${msg}`
    };
  }
}
