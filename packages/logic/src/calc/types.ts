/**
 * Badawi Fleet Platform - Calculated Columns & Formula Engine Types
 * Ref: ADR-057 (الأعمدة المحسوبة وترجمة صيغ Sheets البسيطة / Calculated Columns & Safe Parser)
 * Ref: D-051 (الأسعار التقديرية والنهائية بتواريخ سريان / Effective-Dated Pricing)
 */

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string | number | boolean;
  raw: string;
  pos: number;
}

export type ASTNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | IdentifierNode
  | UnaryOpNode
  | BinaryOpNode
  | FunctionCallNode;

export interface NumberLiteralNode {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteralNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteralNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: '-' | '+' | 'NOT';
  argument: ASTNode;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator:
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | '^'
    | '=='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | 'AND'
    | 'OR';
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

/**
 * Historical price item with effective date window (D-051, ADR-057).
 * Ensures older closed periods preserve their original pricing rate unchanged.
 */
export interface PriceEntry {
  id: string;
  category: 'tractor' | 'truck' | 'private' | string;
  itemKey?: string; // e.g. Route code, vehicle ID, material type
  rate: number; // Price per haul/trip in EGP
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD (optional, open-ended if null/empty)
  description?: string;
}

export interface PriceTable {
  version: number;
  entries: PriceEntry[];
}

export interface EvaluationContext {
  row: Record<string, any>;
  priceTable?: PriceTable;
  date?: string; // Reference date for effective-dated price lookup (YYYY-MM-DD)
  customFunctions?: Record<string, (...args: any[]) => any>;
}

export interface EvaluationResult {
  value: any;
  success: boolean;
  error?: string;
}

export interface SheetsFormulaTranslationResult {
  translatedFormula: string | null;
  isSupported: boolean;
  reason?: string;
}
