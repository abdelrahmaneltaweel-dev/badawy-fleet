/**
 * Badawi Fleet Platform - Safe Expression Evaluator (No eval, No new Function)
 * Ref: ADR-057 (المحلل بلا eval / Safe Parser without eval)
 */

import type { ASTNode, EvaluationContext } from './types.js';
import { lookupPrice } from './pricing.js';

export class Evaluator {
  private context: EvaluationContext;

  constructor(context: EvaluationContext) {
    this.context = context;
  }

  public evaluate(node: ASTNode): any {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'BooleanLiteral':
        return node.value;

      case 'Identifier':
        return this.resolveIdentifier(node.name);

      case 'UnaryOp': {
        const val = this.evaluate(node.argument);
        if (node.operator === '-') {
          const num = typeof val === 'number' ? val : parseFloat(val);
          return isNaN(num) ? 0 : -num;
        }
        if (node.operator === '+') {
          const num = typeof val === 'number' ? val : parseFloat(val);
          return isNaN(num) ? 0 : num;
        }
        if (node.operator === 'NOT') {
          return !this.toBoolean(val);
        }
        throw new Error(`Unsupported unary operator: ${node.operator}`);
      }

      case 'BinaryOp':
        return this.evaluateBinaryOp(node);

      case 'FunctionCall':
        return this.evaluateFunctionCall(node);

      default:
        throw new Error(`Unsupported AST node type: ${(node as any).type}`);
    }
  }

  private resolveIdentifier(name: string): any {
    const row = this.context.row || {};

    // 1. Direct exact property match (e.g. "hauls", "نقلات", "A2")
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }

    // 2. Case-insensitive / normalized lookup
    const targetNorm = name.trim().toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === targetNorm) {
        return row[key];
      }
    }

    // 3. Fallback common aliases
    const aliases: Record<string, string[]> = {
      hauls: ['نقلات', 'عدد النقلات', 'haul_count', 'hauls_count', 'trips', 'مشاوير'],
      rate: ['سعر', 'أجر', 'سعر النقلة', 'أجر النقلة', 'price', 'rate_per_haul'],
      total: ['إجمالي', 'المجموع', 'total_amount', 'net'],
      vehicle: ['عربية', 'رقم العربية', 'vehicle_id', 'vehicleId'],
      driver: ['سائق', 'اسم السائق', 'driver_name', 'driverName']
    };

    for (const [canonical, syns] of Object.entries(aliases)) {
      if (targetNorm === canonical || syns.includes(targetNorm)) {
        if (Object.prototype.hasOwnProperty.call(row, canonical)) return row[canonical];
        for (const s of syns) {
          if (Object.prototype.hasOwnProperty.call(row, s)) return row[s];
        }
      }
    }

    // If identifier is not found in row, return 0 for numerical context or null
    return 0;
  }

  private evaluateBinaryOp(node: { operator: string; left: ASTNode; right: ASTNode }): any {
    // Short-circuit logical operators
    if (node.operator === 'AND') {
      const leftVal = this.evaluate(node.left);
      if (!this.toBoolean(leftVal)) return false;
      return this.toBoolean(this.evaluate(node.right));
    }

    if (node.operator === 'OR') {
      const leftVal = this.evaluate(node.left);
      if (this.toBoolean(leftVal)) return true;
      return this.toBoolean(this.evaluate(node.right));
    }

    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return `${left ?? ''}${right ?? ''}`;
        }
        return this.toNumber(left) + this.toNumber(right);

      case '-':
        return this.toNumber(left) - this.toNumber(right);

      case '*':
        return this.toNumber(left) * this.toNumber(right);

      case '/': {
        const divisor = this.toNumber(right);
        if (divisor === 0) return 0; // Safe division by zero (D-057)
        return this.toNumber(left) / divisor;
      }

      case '%': {
        const divisor = this.toNumber(right);
        if (divisor === 0) return 0;
        return this.toNumber(left) % divisor;
      }

      case '^':
        return Math.pow(this.toNumber(left), this.toNumber(right));

      case '==':
        return this.isEqual(left, right);

      case '!=':
        return !this.isEqual(left, right);

      case '<':
        return this.toNumber(left) < this.toNumber(right);

      case '<=':
        return this.toNumber(left) <= this.toNumber(right);

      case '>':
        return this.toNumber(left) > this.toNumber(right);

      case '>=':
        return this.toNumber(left) >= this.toNumber(right);

      default:
        throw new Error(`Unsupported binary operator: ${node.operator}`);
    }
  }

  private evaluateFunctionCall(node: { name: string; args: ASTNode[] }): any {
    const fnName = node.name.toUpperCase();

    // 1. Lazy evaluation for IF (D-057): only evaluate branch taken
    if (fnName === 'IF') {
      if (node.args.length < 2 || node.args.length > 3) {
        throw new Error(`IF function expects 2 or 3 arguments, got ${node.args.length}`);
      }
      const condition = this.toBoolean(this.evaluate(node.args[0]));
      if (condition) {
        return this.evaluate(node.args[1]);
      } else {
        return node.args.length === 3 ? this.evaluate(node.args[2]) : null;
      }
    }

    // 2. Custom functions defined in context
    if (this.context.customFunctions && typeof this.context.customFunctions[node.name] === 'function') {
      const evaluatedArgs = node.args.map((arg) => this.evaluate(arg));
      return this.context.customFunctions[node.name](...evaluatedArgs);
    }

    // Standard built-in math & logic functions (D-057)
    const args = node.args.map((a) => this.evaluate(a));

    switch (fnName) {
      case 'ROUND': {
        const val = this.toNumber(args[0]);
        const decimals = args.length > 1 ? Math.max(0, Math.floor(this.toNumber(args[1]))) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round((val + Number.EPSILON) * factor) / factor;
      }

      case 'MIN': {
        if (args.length === 0) return 0;
        const numbers = args.map((a) => this.toNumber(a));
        return Math.min(...numbers);
      }

      case 'MAX': {
        if (args.length === 0) return 0;
        const numbers = args.map((a) => this.toNumber(a));
        return Math.max(...numbers);
      }

      case 'ABS':
        return Math.abs(this.toNumber(args[0]));

      case 'FLOOR':
        return Math.floor(this.toNumber(args[0]));

      case 'CEIL':
        return Math.ceil(this.toNumber(args[0]));

      case 'COALESCE': {
        for (const arg of args) {
          if (arg !== null && arg !== undefined && arg !== '') {
            return arg;
          }
        }
        return null;
      }

      case 'SUM':
        return args.reduce((acc, curr) => acc + this.toNumber(curr), 0);

      case 'AVG':
      case 'AVERAGE': {
        if (args.length === 0) return 0;
        const sum = args.reduce((acc, curr) => acc + this.toNumber(curr), 0);
        return sum / args.length;
      }

      case 'PRICE': {
        // Syntax: PRICE(category, [itemKey], [targetDate])
        const category = String(args[0] ?? '').trim();
        const itemKey = args.length > 1 && args[1] !== null ? String(args[1]).trim() : undefined;
        const date = args.length > 2 && args[2] ? String(args[2]).slice(0, 10) : this.context.date || '';

        const resolved = lookupPrice(this.context.priceTable, category, date, itemKey);
        return resolved ?? 0;
      }

      default:
        throw new Error(`Unknown function: '${node.name}'`);
    }
  }

  private toNumber(val: any): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val === null || val === undefined || val === '') return 0;
    const parsed = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  private toBoolean(val: any): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0 && !isNaN(val);
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === '') return false;
      return true;
    }
    return Boolean(val);
  }

  private isEqual(a: any, b: any): boolean {
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < Number.EPSILON;
    }
    // Allow numeric string equality e.g. "116" == 116
    if ((typeof a === 'number' && typeof b === 'string') || (typeof a === 'string' && typeof b === 'number')) {
      const numA = typeof a === 'number' ? a : parseFloat(String(a));
      const numB = typeof b === 'number' ? b : parseFloat(String(b));
      if (!isNaN(numA) && !isNaN(numB)) {
        return Math.abs(numA - numB) < Number.EPSILON;
      }
    }
    return a === b;
  }
}
