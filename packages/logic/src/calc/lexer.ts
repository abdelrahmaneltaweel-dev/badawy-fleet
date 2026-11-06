/**
 * Badawi Fleet Platform - Safe Expression Lexer (Tokenizer)
 * Ref: ADR-057 (Safe Parser without eval / محلل بلا eval)
 */

import type { Token } from './types.js';

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const len = input.length;

  while (pos < len) {
    const ch = input[pos];

    // Skip whitespace
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Number literal (e.g. 42, 3.14, .5)
    if (/\d/.test(ch) || (ch === '.' && pos + 1 < len && /\d/.test(input[pos + 1]))) {
      const start = pos;
      let hasDot = ch === '.';
      pos++;
      while (pos < len) {
        const next = input[pos];
        if (/\d/.test(next)) {
          pos++;
        } else if (next === '.' && !hasDot) {
          hasDot = true;
          pos++;
        } else {
          break;
        }
      }
      const raw = input.slice(start, pos);
      tokens.push({
        type: 'NUMBER',
        value: parseFloat(raw),
        raw,
        pos: start
      });
      continue;
    }

    // String literal with single or double quotes
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = pos;
      pos++; // skip opening quote
      let value = '';
      let closed = false;

      while (pos < len) {
        const curr = input[pos];
        if (curr === '\\' && pos + 1 < len) {
          value += input[pos + 1];
          pos += 2;
        } else if (curr === quote) {
          pos++; // skip closing quote
          closed = true;
          break;
        } else {
          value += curr;
          pos++;
        }
      }

      if (!closed) {
        throw new Error(`Unterminated string literal starting at position ${start}`);
      }

      tokens.push({
        type: 'STRING',
        value,
        raw: input.slice(start, pos),
        pos: start
      });
      continue;
    }

    // Bracketed identifier: e.g. [نقلات], [Total Hauls], [أجر النقلة]
    if (ch === '[') {
      const start = pos;
      pos++; // skip '['
      let name = '';
      let closed = false;

      while (pos < len) {
        if (input[pos] === ']') {
          pos++;
          closed = true;
          break;
        }
        name += input[pos];
        pos++;
      }

      if (!closed) {
        throw new Error(`Unterminated bracketed identifier starting at position ${start}`);
      }

      tokens.push({
        type: 'IDENTIFIER',
        value: name.trim(),
        raw: input.slice(start, pos),
        pos: start
      });
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', raw: '(', pos });
      pos++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', raw: ')', pos });
      pos++;
      continue;
    }

    // Arguments separator: comma or semicolon (Excel Arabic/European uses semicolon)
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',', raw: ch, pos });
      pos++;
      continue;
    }

    // Two-character operators: ==, !=, <>, <=, >=, &&, ||
    if (pos + 1 < len) {
      const two = input.slice(pos, pos + 2);
      if (two === '==' || two === '!=') {
        tokens.push({ type: 'OPERATOR', value: two, raw: two, pos });
        pos += 2;
        continue;
      }
      if (two === '<>') {
        tokens.push({ type: 'OPERATOR', value: '!=', raw: two, pos });
        pos += 2;
        continue;
      }
      if (two === '<=' || two === '>=') {
        tokens.push({ type: 'OPERATOR', value: two, raw: two, pos });
        pos += 2;
        continue;
      }
      if (two === '&&') {
        tokens.push({ type: 'OPERATOR', value: 'AND', raw: two, pos });
        pos += 2;
        continue;
      }
      if (two === '||') {
        tokens.push({ type: 'OPERATOR', value: 'OR', raw: two, pos });
        pos += 2;
        continue;
      }
    }

    // Single-character operators: +, -, *, /, %, ^, <, >, =, ×, ÷
    if (ch === '+' || ch === '-' || ch === '%' || ch === '^' || ch === '<' || ch === '>') {
      tokens.push({ type: 'OPERATOR', value: ch, raw: ch, pos });
      pos++;
      continue;
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ type: 'OPERATOR', value: '*', raw: ch, pos });
      pos++;
      continue;
    }
    if (ch === '/' || ch === '÷') {
      tokens.push({ type: 'OPERATOR', value: '/', raw: ch, pos });
      pos++;
      continue;
    }
    if (ch === '=') {
      // In Excel/formula syntax, single '=' is equality comparison
      tokens.push({ type: 'OPERATOR', value: '==', raw: ch, pos });
      pos++;
      continue;
    }

    // Identifiers, keywords, function names, cell references (A2, B10, etc.)
    // Support Arabic unicode characters (\u0600-\u06FF) and standard letters
    if (/[a-zA-Z_\u0600-\u06FF]/.test(ch)) {
      const start = pos;
      while (pos < len && /[a-zA-Z0-9_\u0600-\u06FF]/.test(input[pos])) {
        pos++;
      }
      const raw = input.slice(start, pos);
      const upper = raw.toUpperCase();

      if (upper === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true, raw, pos: start });
      } else if (upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false, raw, pos: start });
      } else if (upper === 'AND' || upper === 'OR') {
        tokens.push({ type: 'OPERATOR', value: upper, raw, pos: start });
      } else if (upper === 'NOT') {
        tokens.push({ type: 'OPERATOR', value: 'NOT', raw, pos: start });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: raw, raw, pos: start });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${pos}`);
  }

  tokens.push({ type: 'EOF', value: '', raw: '', pos: len });
  return tokens;
}
