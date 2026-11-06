// Multi-row statements packed under the statement limits of the strictest SQL
// backend we run on (Cloudflare D1): at most 100 bound parameters and 100 KB
// per statement. Every SQL store uses the same packing, so a batch that works
// on node:sqlite also works on D1.

import type { SqlStatement, SqlValue } from './driver.ts';

/** Per-statement caps a generated statement must respect. */
export interface StatementLimits {
  /** Bound `?` parameters per statement. */
  maxParams: number;
  /** Statement size in bytes, as measured by statementBytes(). */
  maxBytes: number;
}

/** D1's documented per-statement limits (developers.cloudflare.com/d1/platform/limits). */
export const STATEMENT_LIMITS: Readonly<StatementLimits> = { maxParams: 100, maxBytes: 100_000 };

/** UTF-8 byte length of a string, without TextEncoder (stores/sql has no Web or Node globals). */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4; // surrogate pair = one 4-byte code point
      i++;
    } else n += 3; // BMP, or a lone surrogate (encoded as U+FFFD, 3 bytes)
  }
  return n;
}

/** Bytes a bound value contributes to statementBytes(). */
export function valueBytes(v: SqlValue): number {
  if (typeof v === 'string') return utf8Length(v);
  return v === null ? 0 : 8;
}

/**
 * Size of a statement: its SQL text plus its bound values.
 * Why the values too: D1 documents the 100 KB cap for the statement only and
 * does not say how bindings are counted, so counting them keeps us under the
 * cap whichever way it is enforced. Rows are small, so the cost is nil.
 */
export function statementBytes(stmt: SqlStatement): number {
  let n = utf8Length(stmt.sql);
  for (const p of stmt.params) n += valueBytes(p);
  return n;
}

/** One packable unit: its SQL fragment (e.g. `(?, ?)`) and the values it binds. */
export interface SqlTuple {
  text: string;
  params: SqlValue[];
}

/**
 * Pack tuples greedily into `prefix + t1 + sep + t2 ... + suffix` statements so
 * none exceeds `limits`. A tuple that alone exceeds maxBytes still gets its own
 * statement: it cannot be split, and refusing it would lose the row silently.
 * Throws RangeError when one tuple binds more than maxParams (a schema bug).
 */
export function packStatements(
  prefix: string,
  sep: string,
  suffix: string,
  tuples: readonly SqlTuple[],
  limits: StatementLimits = STATEMENT_LIMITS,
): SqlStatement[] {
  const fixedBytes = utf8Length(prefix) + utf8Length(suffix);
  const sepBytes = utf8Length(sep);
  const out: SqlStatement[] = [];
  let texts: string[] = [];
  let params: SqlValue[] = [];
  let bytes = fixedBytes;

  const flush = (): void => {
    if (texts.length === 0) return;
    out.push({ sql: prefix + texts.join(sep) + suffix, params });
    texts = [];
    params = [];
    bytes = fixedBytes;
  };

  for (const t of tuples) {
    if (t.params.length > limits.maxParams) {
      throw new RangeError(`one tuple binds ${t.params.length} parameters; the limit is ${limits.maxParams}`);
    }
    let tBytes = utf8Length(t.text);
    for (const p of t.params) tBytes += valueBytes(p);
    const extra = texts.length === 0 ? tBytes : sepBytes + tBytes;
    if (texts.length > 0 && (params.length + t.params.length > limits.maxParams || bytes + extra > limits.maxBytes)) {
      flush();
      bytes += tBytes;
    } else {
      bytes += extra;
    }
    texts.push(t.text);
    for (const p of t.params) params.push(p);
  }
  flush();
  return out;
}

/** How one table is written: column order and the conflict clause that encodes its merge rule. */
export interface TableSpec<R> {
  table: string;
  columns: readonly (keyof R & string)[];
  /** Appended after VALUES, e.g. `ON CONFLICT (id) DO NOTHING`. */
  onConflict: string;
}

/** `(?, ?, ...)` with one placeholder per column. */
export function placeholders(n: number): string {
  return `(${Array.from({ length: n }, () => '?').join(', ')})`;
}

/** Multi-row `INSERT ... VALUES (...), (...) ON CONFLICT ...` statements for `rows`, packed under `limits`. */
export function buildInserts<R>(spec: TableSpec<R>, rows: readonly R[], limits: StatementLimits = STATEMENT_LIMITS): SqlStatement[] {
  if (rows.length === 0) return [];
  const tuple = placeholders(spec.columns.length);
  const tuples = rows.map((row) => ({ text: tuple, params: spec.columns.map((c) => toSqlValue(row[c], c)) }));
  return packStatements(`INSERT INTO ${spec.table} (${spec.columns.join(', ')}) VALUES `, ', ', ` ${spec.onConflict}`, tuples, limits);
}

/**
 * `DELETE` statements removing exactly the rows with these primary keys.
 * One key column: `WHERE k IN (?, ...)`; several: `WHERE (a, b) IN (VALUES (?, ?), ...)`.
 */
export function buildKeyedDeletes(
  table: string,
  keyColumns: readonly string[],
  keys: readonly SqlValue[][],
  limits: StatementLimits = STATEMENT_LIMITS,
): SqlStatement[] {
  if (keys.length === 0) return [];
  if (keyColumns.length === 1) {
    return packStatements(`DELETE FROM ${table} WHERE ${keyColumns[0]} IN (`, ', ', ')', keys.map((k) => ({ text: '?', params: k })), limits);
  }
  const tuple = placeholders(keyColumns.length);
  return packStatements(
    `DELETE FROM ${table} WHERE (${keyColumns.join(', ')}) IN (VALUES `,
    ', ',
    ')',
    keys.map((k) => ({ text: tuple, params: k })),
    limits,
  );
}

/** Narrow a row field to a bindable value; anything else is a bug in the op that built the row. */
export function toSqlValue(v: unknown, column: string): SqlValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new TypeError(`column ${column}: non-finite number`);
    return v;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new TypeError(`column ${column}: cannot bind a ${typeof v}`);
}
