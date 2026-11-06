/**
 * Badawi Fleet Platform - Recursive Descent Expression Parser
 * Ref: ADR-057 (Safe Parser without eval / محلل بلا eval)
 */

import type { ASTNode, Token } from './types.js';
import { tokenize } from './lexer.js';

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): ASTNode {
    const node = this.parseExpression();
    if (!this.isAtEnd()) {
      const tok = this.peek();
      throw new Error(`Unexpected token '${tok.raw}' at position ${tok.pos}`);
    }
    return node;
  }

  // 1. OR level
  private parseExpression(): ASTNode {
    let expr = this.parseAnd();

    while (this.matchOperator('OR')) {
      const operator = 'OR';
      const right = this.parseAnd();
      expr = { type: 'BinaryOp', operator, left: expr, right };
    }

    return expr;
  }

  // 2. AND level
  private parseAnd(): ASTNode {
    let expr = this.parseEquality();

    while (this.matchOperator('AND')) {
      const operator = 'AND';
      const right = this.parseEquality();
      expr = { type: 'BinaryOp', operator, left: expr, right };
    }

    return expr;
  }

  // 3. Equality & Comparison: ==, !=, <, <=, >, >=
  private parseEquality(): ASTNode {
    let expr = this.parseAdditive();

    while (this.checkOperator('==', '!=', '<', '<=', '>', '>=')) {
      const tok = this.advance();
      const operator = tok.value as any;
      const right = this.parseAdditive();
      expr = { type: 'BinaryOp', operator, left: expr, right };
    }

    return expr;
  }

  // 4. Additive: +, -
  private parseAdditive(): ASTNode {
    let expr = this.parseMultiplicative();

    while (this.checkOperator('+', '-')) {
      const tok = this.advance();
      const operator = tok.value as any;
      const right = this.parseMultiplicative();
      expr = { type: 'BinaryOp', operator, left: expr, right };
    }

    return expr;
  }

  // 5. Multiplicative: *, /, %
  private parseMultiplicative(): ASTNode {
    let expr = this.parsePower();

    while (this.checkOperator('*', '/', '%')) {
      const tok = this.advance();
      const operator = tok.value as any;
      const right = this.parsePower();
      expr = { type: 'BinaryOp', operator, left: expr, right };
    }

    return expr;
  }

  // 6. Power: ^
  private parsePower(): ASTNode {
    let expr = this.parseUnary();

    while (this.checkOperator('^')) {
      this.advance();
      const right = this.parsePower(); // Right-associative
      expr = { type: 'BinaryOp', operator: '^', left: expr, right };
    }

    return expr;
  }

  // 7. Unary: -, +, NOT
  private parseUnary(): ASTNode {
    if (this.checkOperator('-', '+', 'NOT')) {
      const tok = this.advance();
      const operator = tok.value as any;
      const argument = this.parseUnary();
      return { type: 'UnaryOp', operator, argument };
    }

    return this.parsePrimary();
  }

  // 8. Primary: Numbers, Strings, Booleans, Identifiers, Function Calls, (Expr)
  private parsePrimary(): ASTNode {
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.advance();
      return { type: 'NumberLiteral', value: tok.value as number };
    }

    if (tok.type === 'STRING') {
      this.advance();
      return { type: 'StringLiteral', value: tok.value as string };
    }

    if (tok.type === 'BOOLEAN') {
      this.advance();
      return { type: 'BooleanLiteral', value: tok.value as boolean };
    }

    // Parenthesized expression
    if (tok.type === 'LPAREN') {
      this.advance(); // consume '('
      const expr = this.parseExpression();
      this.consume('RPAREN', `Expected ')' after expression at position ${this.peek().pos}`);
      return expr;
    }

    // Function call or Identifier
    if (tok.type === 'IDENTIFIER') {
      this.advance();
      const name = tok.value as string;

      // Check if followed by '(' -> Function call
      if (this.check('LPAREN')) {
        this.advance(); // consume '('
        const args: ASTNode[] = [];

        if (!this.check('RPAREN')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('COMMA'));
        }

        this.consume('RPAREN', `Expected ')' after function arguments for '${name}' at position ${this.peek().pos}`);
        return { type: 'FunctionCall', name, args };
      }

      return { type: 'Identifier', name };
    }

    throw new Error(`Unexpected token '${tok.raw}' at position ${tok.pos}`);
  }

  // Helper utilities
  private peek(): Token {
    return this.tokens[this.current];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: string[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private checkOperator(...ops: string[]): boolean {
    if (this.isAtEnd()) return false;
    const tok = this.peek();
    return tok.type === 'OPERATOR' && ops.includes(tok.value as string);
  }

  private matchOperator(...ops: string[]): boolean {
    if (this.checkOperator(...ops)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: string, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(message);
  }
}

export function parse(input: string): ASTNode {
  // Strip optional leading '=' (standard in spreadsheet formulas e.g. =A2*B2)
  const trimmed = input.trim();
  const formula = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
  if (!formula) {
    throw new Error('Empty formula expression');
  }
  const tokens = tokenize(formula);
  const parser = new Parser(tokens);
  return parser.parse();
}
