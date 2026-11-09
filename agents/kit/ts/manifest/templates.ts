// Template strings, argv and env: {{placeholder}}s from PLACEHOLDERS, filled
// in by the host; ${…} passes through untouched for the program's own
// expansion. {{password}} goes only in env values, so it never shows in a
// process list, a URL or a log line.
import { fields, isObject, list, oneOf, record, string, type Add, type Json } from './primitives.ts';
import { GUEST_PLACEHOLDERS, MAX, PATTERNS, PLACEHOLDERS, SECRET_PLACEHOLDER } from './rules.ts';

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

/** A template; `secret` allows {{password}} (env values only). */
export function template(add: Add, path: string, value: unknown, secret = false): boolean {
  if (!string(add, path, value, undefined, MAX.template)) return false;
  let named = true;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!PLACEHOLDERS.includes(name)) {
      add(path, 'unknown', `unknown placeholder {{${name}}} (known: ${PLACEHOLDERS.join(', ')})`);
      named = false;
    } else if (name === SECRET_PLACEHOLDER && !secret) {
      add(path, 'forbidden', `{{${SECRET_PLACEHOLDER}}} goes only in env values`);
      named = false;
    }
  }
  // Every placeholder is known; what is left is a stray {{ or }}.
  return named && string(add, path, value, secret ? PATTERNS.envTemplate : PATTERNS.template);
}

/** A template run in the guest (install steps, version checks, runtime paths): {{home}} is its one placeholder. */
export function guestTemplate(add: Add, path: string, value: unknown): boolean {
  if (!string(add, path, value, undefined, MAX.template)) return false;
  let named = true;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!GUEST_PLACEHOLDERS.includes(name)) {
      add(path, 'unknown', `{{${name}}} has no value in the guest (only {{${GUEST_PLACEHOLDERS.join('}}, {{')}}})`);
      named = false;
    }
  }
  return named && string(add, path, value, PATTERNS.guestTemplate);
}

/** A path on the engine's base URL, placeholders allowed. */
export function httpPath(add: Add, path: string, value: unknown): boolean {
  return template(add, path, value) && string(add, path, value, PATTERNS.httpPath);
}

/** `{ path, ...extra }` with every key required; the object when it is one. */
export function httpBlock(add: Add, path: string, value: unknown, extra: string[] = []): Json | null {
  const known = ['path', ...extra];
  if (!fields(add, path, value, known, known)) return null;
  const block = value as Json;
  httpPath(add, `${path}/path`, block.path);
  return block;
}

/** A process: argv (the program first) and env; `extra` names more allowed keys. */
export function command(add: Add, path: string, value: unknown, extra: string[] = []): Json | null {
  if (!fields(add, path, value, ['argv', 'env', ...extra], ['argv'])) return null;
  const c = value as Json;
  argv(add, `${path}/argv`, c.argv);
  if ('env' in c) env(add, `${path}/env`, c.env);
  return c;
}

function argv(add: Add, path: string, value: unknown) {
  if (!list(add, path, value, { min: 1, unique: false }, (p, item) => templateArg(add, p, item))) return;
  if (value.length > 0 && typeof value[0] !== 'string') add(`${path}/0`, 'type', 'the program is a template, never conditional');
}

// A template, or `{ when, args }`: args included only when the placeholder
// `when` names has a non-empty value.
function templateArg(add: Add, path: string, value: unknown) {
  if (!isObject(value)) {
    template(add, path, value);
    return;
  }
  if (!fields(add, path, value, ['when', 'args'], ['when', 'args'])) return;
  oneOf(add, `${path}/when`, value.when, PLACEHOLDERS);
  list(add, `${path}/args`, value.args, { min: 1, unique: false }, (p, v) => template(add, p, v));
}

function env(add: Add, path: string, value: unknown) {
  record(add, path, value, (p, name, v) => {
    if (string(add, p, name, PATTERNS.envName, MAX.envName) && new RegExp(PATTERNS.envReserved, 'u').test(name)) {
      add(p, 'reserved', `${name} is the host's to set`);
    }
    template(add, p, v, true);
  });
}
