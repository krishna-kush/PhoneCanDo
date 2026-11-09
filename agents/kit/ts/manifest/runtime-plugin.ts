// Validates one runtime plugin manifest (agents/runtimes/<id>/runtime.json,
// schema 1): every rule of agents/kit/schema/runtime.schema.json, plus the
// ones JSON Schema cannot say (each family it claims has an install script,
// a check pattern the guest's grep and sed can run). A runtime is installed
// only into the machine of an agent that needs it, and depends on no agent
// and no other runtime. Folder rules (folder = id, the scripts exist, the
// kinds that name it) live in agents/kit/cli/manifests.mjs.
import { checkVersionCheck } from './install.ts';
import { fields, integer, list, oneOf, record, relPath, string, text, type Add, type Json } from './primitives.ts';
import { ANY_FAMILY, FAMILIES, MAX, PATTERNS, SCHEMA_VERSION } from './rules.ts';
import { guestTemplate } from './templates.ts';
import type { Problem, ValidationResult } from './types.ts';

export const PLUGIN_REQUIRED = ['schema', 'id', 'label', 'provides', 'families', 'install', 'check', 'licence'];
export const PLUGIN_FIELDS = [...PLUGIN_REQUIRED, 'paths'];

export function validateRuntime(json: unknown): ValidationResult {
  const problems: Problem[] = [];
  const add: Add = (path, code, detail) => {
    if (!problems.some((p) => p.path === path && p.code === code)) problems.push({ path, code, detail });
  };
  if (!fields(add, '', json, PLUGIN_FIELDS, PLUGIN_REQUIRED)) return { ok: false, problems };
  const r = json as Json;
  if ('schema' in r && r.schema !== SCHEMA_VERSION) add('/schema', 'const', `schema must be ${SCHEMA_VERSION}`);
  string(add, '/id', r.id, PATTERNS.name, MAX.name);
  text(add, '/label', r.label);
  integer(add, '/provides', r.provides, 1, MAX.major);
  const named = list(add, '/families', r.families, { min: 1, unique: true }, (path, v) => oneOf(add, path, v, FAMILIES));
  checkScripts(add, r.install, named ? (r.families as unknown[]) : null);
  list(add, '/paths', r.paths, { min: 0, unique: true }, (path, v) => {
    if (guestTemplate(add, path, v)) string(add, path, v, PATTERNS.guestPath, MAX.relPath);
  });
  const check = checkVersionCheck(add, '/check', r.check);
  if (check && typeof check.pattern === 'string') {
    const why = ereProblem(check.pattern);
    if (why) add('/check/pattern', 'pattern', `the guest's grep -E runs it, but ${why}`);
  }
  if (fields(add, '/licence', r.licence, ['spdx', 'source'], ['spdx', 'source'])) {
    const l = r.licence as Json;
    string(add, '/licence/spdx', l.spdx, PATTERNS.spdx, MAX.text);
    string(add, '/licence/source', l.source, PATTERNS.url, MAX.url);
  }
  return { ok: problems.length === 0, problems };
}

// One script per family, `*` for the rest: every family the runtime claims
// has one, and no key names a family it does not claim.
function checkScripts(add: Add, install: unknown, families: unknown[] | null) {
  const ok = record(add, '/install', install, (path, family, script) => {
    if (family !== ANY_FAMILY && oneOf(add, path, family, FAMILIES) && families && !families.includes(family)) {
      add(path, 'mismatch', `${family} is not in families`);
    }
    relPath(add, path, script);
  });
  if (!ok || !families) return;
  const keys = Object.keys(install as Json);
  if (keys.length === 0) add('/install', 'length', 'names at least one install script');
  if (keys.includes(ANY_FAMILY)) return;
  for (const family of families) {
    if (typeof family === 'string' && !keys.includes(family)) add('/install', 'required', `${family} has no install script (name it, or "*")`);
  }
}

/**
 * Why `pattern` has no POSIX ERE form, or null. The install script tests a
 * runtime with the guest's grep -E and sed -E before installing it, so the
 * pattern keeps to what translates (kit-render's ShellRegex does it): no
 * (?…) groups, no lazy or possessive quantifiers, no nested brackets, and
 * escapes only \d \s \w or an escaped symbol (in a bracket: \d \s \w \.).
 */
export function ereProblem(pattern: string): string | null {
  let bracket = -1; // where the open bracket's items start, or -1
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\') {
      const next = pattern[i + 1];
      if (next === undefined) return 'it ends in a lone backslash';
      const ok = 'dsw'.includes(next) || (bracket >= 0 ? next === '.' : !/[A-Za-z0-9]/.test(next));
      if (!ok) return `\\${next} has no POSIX ERE form there`;
      i += 2;
    } else if (bracket >= 0) {
      if (c === '[') return 'a [ inside a bracket expression has no POSIX ERE form';
      if (c === ']' && i > bracket) bracket = -1;
      i += 1;
    } else if (c === '[') {
      bracket = pattern[i + 1] === '^' ? i + 2 : i + 1;
      i = bracket;
    } else if (c === '(' && pattern[i + 1] === '?') {
      return '(?…) groups have no POSIX ERE form';
    } else if ('*+?}'.includes(c) && (pattern[i + 1] === '?' || pattern[i + 1] === '+')) {
      return 'lazy and possessive quantifiers have no POSIX ERE form';
    } else {
      i += 1;
    }
  }
  return bracket >= 0 ? 'a bracket expression is not closed' : null;
}
