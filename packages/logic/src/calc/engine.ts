/**
 * Badawi Fleet Platform - Calculated Column Engine
 * Ref: ADR-057 (الأعمدة المحسوبة وترجمة صيغ Sheets البسيطة / Calculated Columns & Safe Parser)
 * Ref: D-051, D-057, D-031
 */

import type { EvaluationContext, EvaluationResult, PriceTable } from './types.js';
import { parse } from './parser.js';
import { Evaluator } from './evaluator.js';

/**
 * Safely evaluates a single formula expression against a data row.
 */
export function evaluateFormula(formula: string, context: EvaluationContext): EvaluationResult {
  try {
    const ast = parse(formula);
    const evaluator = new Evaluator(context);
    const value = evaluator.evaluate(ast);
    return {
      value,
      success: true
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      value: null,
      success: false,
      error: msg
    };
  }
}

/**
 * Pre-compiles an expression AST once so it can be evaluated across hundreds of rows with optimal speed.
 */
export function compileFormula(formula: string): (context: EvaluationContext) => any {
  const ast = parse(formula);
  return (context: EvaluationContext) => {
    const evaluator = new Evaluator(context);
    return evaluator.evaluate(ast);
  };
}

/**
 * Evaluates a calculated column formula across an entire array of tabular records.
 */
export function evaluateColumn(
  formula: string,
  rows: Record<string, any>[],
  options?: {
    priceTable?: PriceTable;
    dateField?: string;
    defaultDate?: string;
    customFunctions?: Record<string, (...args: any[]) => any>;
  }
): any[] {
  if (!rows || rows.length === 0) return [];
  const compiled = compileFormula(formula);
  const dateField = options?.dateField || 'date';
  const defaultDate = options?.defaultDate || new Date().toISOString().slice(0, 10);

  return rows.map((row) => {
    const rowDate = row[dateField] || defaultDate;
    const ctx: EvaluationContext = {
      row,
      priceTable: options?.priceTable,
      date: String(rowDate).slice(0, 10),
      customFunctions: options?.customFunctions
    };
    try {
      return compiled(ctx);
    } catch {
      return null;
    }
  });
}
