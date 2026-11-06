// Reading untrusted JSON without throwing. A Reader records the first failure
// and every reader returns a harmless fallback after it, so a parse() can read
// the whole shape in straight-line code and turn it into a TceResult at the
// end with `done()`. Over-long strings are truncated, never rejected.

import { ok, type ErrorCode, type TceError, type TceResult } from './result.ts';

/** A JSON object as parsed from a request body. */
export type JsonObject = Record<string, unknown>;

/** 2000-01-01T00:00:00Z. Earlier client times are treated as garbage (e.g. seconds, not ms). */
export const EPOCH_MS_MIN = 946_684_800_000;
/** 2200-01-01T00:00:00Z. */
export const EPOCH_MS_MAX = 7_258_118_400_000;
/** Upper bound for counts and sequence numbers (SQL INTEGER fits far more; this is a sanity cap). */
export const INT32_MAX = 2_147_483_647;

/** True for a non-null, non-array object. */
export function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** At most `max` code points from the start; never splits a surrogate pair. */
export function truncate(s: string, max: number): string {
  // A string of <= max UTF-16 units has <= max code points: the common fast path.
  if (s.length <= max) return s;
  let out = '';
  let n = 0;
  for (const ch of s) {
    if (n === max) break;
    out += ch;
    n++;
  }
  return out;
}

/** At most the last `max` code points; for log tails, where the end matters. */
export function truncateTail(s: string, max: number): string {
  if (s.length <= max) return s;
  const points = Array.from(s);
  return points.length <= max ? s : points.slice(points.length - max).join('');
}

/** UTF-8 byte length. */
export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Collects the first validation failure while reading an untrusted value. */
export class Reader {
  #first: TceError | null = null;

  /** The first failure, or null while everything read so far is valid. */
  get error(): TceError | null {
    return this.#first;
  }

  /** Record a failure; only the first one is kept. */
  fail(code: ErrorCode, message: string, field?: string): void {
    if (this.#first) return;
    this.#first = field ? { code, message, field } : { code, message };
  }

  /** `value` as a result, or the first recorded failure. */
  done<T>(value: T): TceResult<T> {
    return this.#first ? { ok: false, error: this.#first } : ok(value);
  }

  /** A required object. Fallback `{}`. */
  object(v: unknown, field: string): JsonObject {
    if (isPlainObject(v)) return v;
    this.fail('bad_request', 'must be an object', field || undefined);
    return {};
  }

  /** An optional object (absent or null gives null). */
  optionalObject(v: unknown, field: string): JsonObject | null {
    if (v === undefined || v === null) return null;
    return this.object(v, field);
  }

  /** A required string, truncated to `max` code points. Fallback ''. */
  string(v: unknown, field: string, max: number): string {
    if (typeof v === 'string') return truncate(v, max);
    this.fail('bad_request', 'must be a string', field);
    return '';
  }

  /** An optional string (absent or null gives null), truncated to `max`. */
  optionalString(v: unknown, field: string, max: number): string | null {
    if (v === undefined || v === null) return null;
    return this.string(v, field, max);
  }

  /** A required string matching `re` exactly (ids: never truncated). Fallback ''. */
  match(v: unknown, field: string, re: RegExp, what: string): string {
    if (typeof v === 'string' && re.test(v)) return v;
    this.fail('bad_request', `must be ${what}`, field);
    return '';
  }

  /** An optional string matching `re` (absent or null gives null). */
  optionalMatch(v: unknown, field: string, re: RegExp, what: string): string | null {
    if (v === undefined || v === null) return null;
    return this.match(v, field, re, what);
  }

  /** One of `values`. Fallback the first value. */
  oneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T {
    if (typeof v === 'string' && (values as readonly string[]).includes(v)) return v as T;
    this.fail('bad_request', `must be one of ${values.join(', ')}`, field);
    return values[0]!;
  }

  /** An optional one of `values` (absent or null gives null). */
  optionalOneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T | null {
    if (v === undefined || v === null) return null;
    return this.oneOf(v, field, values);
  }

  /** A finite number in [min, max]. Fallback `min`. */
  number(v: unknown, field: string, min: number, max: number): number {
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) return v;
    this.fail('bad_request', `must be a number from ${min} to ${max}`, field);
    return min;
  }

  /** An integer in [min, max]. Fallback `min`. */
  int(v: unknown, field: string, min: number, max: number): number {
    if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) return v;
    this.fail('bad_request', `must be an integer from ${min} to ${max}`, field);
    return min;
  }

  /** An optional integer in [min, max] (absent or null gives null). */
  optionalInt(v: unknown, field: string, min: number, max: number): number | null {
    if (v === undefined || v === null) return null;
    return this.int(v, field, min, max);
  }

  /** A plausible epoch-ms integer (EPOCH_MS_MIN..EPOCH_MS_MAX). */
  epochMs(v: unknown, field: string): number {
    if (typeof v === 'number' && Number.isInteger(v) && v >= EPOCH_MS_MIN && v < EPOCH_MS_MAX) return v;
    this.fail('bad_request', 'must be epoch milliseconds', field);
    return EPOCH_MS_MIN;
  }

  /** An optional epoch-ms integer (absent or null gives null). */
  optionalEpochMs(v: unknown, field: string): number | null {
    if (v === undefined || v === null) return null;
    return this.epochMs(v, field);
  }

  /** A required boolean. Fallback false. */
  bool(v: unknown, field: string): boolean {
    if (typeof v === 'boolean') return v;
    this.fail('bad_request', 'must be a boolean', field);
    return false;
  }

  /** An optional boolean (absent or null gives null). */
  optionalBool(v: unknown, field: string): boolean | null {
    if (v === undefined || v === null) return null;
    return this.bool(v, field);
  }

  /** A required array of at most `cap` items; over the cap is `too_large`. Fallback []. */
  list(v: unknown, field: string, cap: number): readonly unknown[] {
    if (!Array.isArray(v)) {
      this.fail('bad_request', 'must be an array', field);
      return [];
    }
    if (v.length > cap) {
      this.fail('too_large', `at most ${cap} items`, field);
      return [];
    }
    return v;
  }
}
