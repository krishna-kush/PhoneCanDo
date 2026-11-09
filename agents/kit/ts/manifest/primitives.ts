// The checks every manifest rule is built from. Each reports through `add`
// and returns whether the value passed, so callers check deeper only then.
import { MAX, PATTERNS } from './rules.ts';
import type { ProblemCode } from './types.ts';

export type Json = Record<string, unknown>;
export type Add = (path: string, code: ProblemCode, detail: string) => void;

// Object with known keys only and its required keys present; false when not
// an object (nothing below it is checked then).
export function fields(add: Add, path: string, value: unknown, known: string[], required: string[]): boolean {
  if (!isObject(value)) {
    add(path, 'type', 'must be an object');
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) add(`${path}/${escape(key)}`, 'unknown', `unknown field ${key}`);
  }
  for (const key of required) {
    if (!(key in value)) add(`${path}/${key}`, 'required', `${key} is required`);
  }
  return true;
}

export function string(add: Add, path: string, value: unknown, pattern?: string, max?: number): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'string') {
    add(path, 'type', 'must be a string');
    return false;
  }
  if (max !== undefined && value.length > max) {
    add(path, 'length', `at most ${max} characters`);
    return false;
  }
  if (pattern !== undefined && !new RegExp(pattern, 'u').test(value)) {
    add(path, 'pattern', `${JSON.stringify(value)} does not match ${pattern}`);
    return false;
  }
  return true;
}

/** A non-empty string of at most `max` characters. */
export function text(add: Add, path: string, value: unknown, max = MAX.text) {
  if (typeof value === 'string' && value.length === 0) add(path, 'length', 'must not be empty');
  else string(add, path, value, undefined, max);
}

export function relPath(add: Add, path: string, value: unknown) {
  string(add, path, value, PATTERNS.relPath, MAX.relPath);
}

/**
 * A regular expression, compiled as the app and the runner compile it: no
 * flags. With `group` (the default) it needs a capture group: group 1 is read.
 */
export function regex(add: Add, path: string, value: unknown, group = true) {
  if (!string(add, path, value, undefined, MAX.regex)) return;
  let groups: number;
  try {
    // An empty alternative always matches, so the match lists every group.
    groups = (new RegExp(`${value as string}|`).exec('')?.length ?? 1) - 1;
  } catch {
    add(path, 'pattern', `${JSON.stringify(value)} is not a valid regular expression`);
    return;
  }
  if (group && groups < 1) add(path, 'pattern', `${JSON.stringify(value)} needs a capture group (group 1 is read)`);
}

export function integer(add: Add, path: string, value: unknown, min: number, max: number) {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isInteger(value)) add(path, 'type', 'must be an integer');
  else if (value < min || value > max) add(path, 'range', `must be ${min} to ${max}`);
}

export function oneOf(add: Add, path: string, value: unknown, allowed: string[]): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    add(path, 'enum', `${JSON.stringify(value)} is not one of ${allowed.join(', ')}`);
    return false;
  }
  return true;
}

/** An object read as a map: `each` sees every entry with its JSON pointer. */
export function record(
  add: Add,
  path: string,
  value: unknown,
  each: (path: string, key: string, value: unknown) => void,
): boolean {
  if (value === undefined) return false;
  if (!isObject(value)) {
    add(path, 'type', 'must be an object');
    return false;
  }
  for (const [key, v] of Object.entries(value)) each(`${path}/${escape(key)}`, key, v);
  return true;
}

export function list(
  add: Add,
  path: string,
  value: unknown,
  rule: { min: number; unique: boolean },
  item: (path: string, value: unknown) => void,
): value is unknown[] {
  if (value === undefined) return false;
  if (!Array.isArray(value)) {
    add(path, 'type', 'must be an array');
    return false;
  }
  if (value.length < rule.min) add(path, 'length', `needs at least ${rule.min} item${rule.min === 1 ? '' : 's'}`);
  if (rule.unique && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) {
    add(path, 'unique', 'items must be unique');
  }
  value.forEach((v, i) => item(`${path}/${i}`, v));
  return true;
}

export function uniqueBy(add: Add, path: string, items: Json[], key: string) {
  const seen = new Set<unknown>();
  items.forEach((item, i) => {
    if (item[key] === undefined) return;
    if (seen.has(item[key])) add(`${path}/${i}/${key}`, 'unique', `${key} ${JSON.stringify(item[key])} appears twice`);
    seen.add(item[key]);
  });
}

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function kindOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

// UTF-8 byte length without TextEncoder (not a global on every host).
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// JSON pointer escaping (RFC 6901).
export function escape(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
