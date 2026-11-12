// Loads every agent kind manifest, agents/{native,image}/<id>/agent.json,
// validated by agents/kit/ts/manifest/validate.ts, and every runtime plugin,
// agents/runtimes/<id>/runtime.json, validated by runtime-plugin.ts, and
// checks them against the folder rules below. Zero deps (Node strips the
// validators' types); the APK audits, payload staging and CI import it, and
// check.mjs prints its problems.
//
// Folder rules, on top of the manifests' own:
//   - every folder under native/ and image/ holds an agent.json, every one
//     under runtimes/ a runtime.json;
//   - the folder is named after the id (a kind's sits under its type);
//   - ids and prefixes are unique across all kinds, and at most one kind is
//     the default (`default: true`: the kind a fresh install starts with);
//   - the files a manifest names exist: the notice, the config folder and
//     its overlay, the required files and an instructions file in
//     config.into (configInstructions; each in the overlay too when
//     full-only), every shared part, agents/shared/<name>/ with its
//     part.json, and every runtime's install scripts;
//   - every runtime a kind needs exists and provides the major version it
//     needs; the families the kind names are ones each of its runtimes
//     installs on, at least one family is left that they all do, and its
//     packages are keyed by those (or `*`);
//   - a kind has a one-shot.json (one-shot.ts) exactly when it has a models
//     block.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRuntimeNeed } from '../ts/manifest/install.ts';
import { ANY_FAMILY, FAMILIES, PATTERNS } from '../ts/manifest/rules.ts';
import { ONE_SHOT_FILE, validateOneShot } from '../ts/manifest/one-shot.ts';
import { validateRuntime } from '../ts/manifest/runtime-plugin.ts';
import { validate } from '../ts/manifest/validate.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const KIND_FOLDERS = ['native', 'image'];
export const RUNTIMES_FOLDER = 'runtimes';
export const RUNTIME_FILE = 'runtime.json';
// agents/shared/<name>/part.json: where a shared part lands inside a kind's
// config and which of its files only full ships. Not packaged itself.
export const PART_FILE = 'part.json';
const PART_FIELDS = ['into', 'fullOnly'];

/**
 * Every kind, every runtime and every problem, never throwing.
 * entries: [{ id, type, dir (absolute), manifest, parts: [{ name, dir, into, fullOnly }] }]
 * runtimes: [{ id, dir (absolute), manifest }]
 * problems: [{ file (repo-relative), path (JSON pointer), code, detail }]
 */
export function scanManifests({ root = REPO_ROOT } = {}) {
  const entries = [];
  const problems = [];
  for (const folder of KIND_FOLDERS) {
    const base = join(root, 'agents', folder);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base).sort()) {
      const dir = join(base, name);
      if (!statSync(dir).isDirectory()) continue;
      const entry = loadOne(root, folder, name, dir, problems);
      if (entry) entries.push(entry);
    }
  }
  unique(entries, problems, 'id', 'duplicate-id');
  unique(entries.filter((e) => e.manifest.prefix), problems, 'prefix', 'duplicate-prefix');
  unique(entries.filter((e) => e.manifest.default === true), problems, 'default', 'duplicate-default');
  const runtimes = scanRuntimes(root, problems);
  for (const entry of entries) checkNeeds(entry, runtimes, problems);
  return { entries, runtimes, problems };
}

/** Every kind, or an Error that lists every problem (the runtimes' included). */
export function loadManifests({ root = REPO_ROOT } = {}) {
  const { entries, problems } = scanManifests({ root });
  if (problems.length) {
    throw new Error(`agent manifests have ${problems.length} problem(s):\n${problems.map(formatProblem).join('\n')}`);
  }
  return entries;
}

export function nativeManifests(root = REPO_ROOT) {
  return loadManifests({ root }).filter((e) => e.type === 'native');
}

/** The kinds a channel (full, lite, play) ships. */
export function forChannel(list, channel) {
  return list.filter((e) => e.manifest.channels.includes(channel));
}

export function formatProblem(p) {
  return `${p.file}${p.path ? ` ${p.path}` : ''}: ${p.code}: ${p.detail}`;
}

/**
 * The kind's instructions file as a file of its packaged config (relative
 * to config.dir) when it lies in config.into, so the config seeds it; null
 * when the kind has no config folder or keeps its instructions elsewhere.
 */
export function configInstructions(manifest) {
  const config = manifest.config;
  const file = manifest.instructions;
  if (!config?.dir || typeof file !== 'string' || !file.startsWith(`${config.into}/`)) return null;
  return file.slice(config.into.length + 1);
}

/** Ant-style glob as Gradle reads config.fullOnly: ** spans folders, * stays in one. */
export function matchesGlob(path, glob) {
  const g = glob.endsWith('/') ? `${glob}**` : glob;
  let re = '';
  for (let i = 0; i < g.length; i += 1) {
    if (g.startsWith('**/', i)) {
      re += '(?:.*/)?';
      i += 2;
    } else if (g.startsWith('**', i)) {
      re += '.*';
      i += 1;
    } else if (g[i] === '*') re += '[^/]*';
    else if (g[i] === '?') re += '[^/]';
    else re += g[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(path);
}

// ---------------------------------------------------------------------------

function loadOne(root, folder, name, dir, problems) {
  const file = `agents/${folder}/${name}/agent.json`;
  const add = (path, code, detail, at = file) => problems.push({ file: at, path, code, detail });
  const manifest = readJson(join(dir, 'agent.json'), file, add);
  if (manifest === undefined) return null;
  const result = validate(manifest, { origin: 'bundled' });
  for (const p of result.problems) add(p.path, p.code, p.detail);
  if (!result.ok) return null;

  if (manifest.id !== name) add('/id', 'folder-name', `id ${manifest.id} sits in folder ${name}`);
  if (manifest.type !== folder) add('/type', 'folder-type', `a ${manifest.type} kind sits under agents/${folder}/`);
  // A missing phoneTools means no bridge (BridgeAccess); a kind we ship says so.
  if (!('phoneTools' in manifest)) add('/phoneTools', 'missing', 'a kind we ship names phoneTools (none for no bridge)');
  const has = (path, rel, kind) => {
    const target = join(dir, rel);
    const ok = existsSync(target) && (kind === 'dir' ? statSync(target).isDirectory() : statSync(target).isFile());
    if (!ok) add(path, 'missing', `${rel} is not a ${kind === 'dir' ? 'folder' : 'file'} in agents/${folder}/${name}/`);
    return ok;
  };
  if (manifest.licence.notice) has('/licence/notice', manifest.licence.notice, 'file');
  const config = manifest.config;
  const parts = [];
  if (config?.dir && has('/config/dir', config.dir, 'dir')) {
    const overlay = config.overlay && has('/config/overlay', config.overlay, 'dir');
    const files = [...(config.required ?? []).map((f) => ['/config/required', f]), ['/instructions', configInstructions(manifest)]];
    for (const [path, rel] of files) {
      if (!rel) continue;
      has(path, join(config.dir, rel), 'file');
      const fullOnly = (config.fullOnly ?? []).some((g) => matchesGlob(rel, g));
      if (fullOnly && overlay) has(path, join(config.overlay, rel), 'file');
      if (fullOnly && !config.overlay) add(path, 'missing', `${rel} is full-only and no overlay replaces it`);
    }
    for (const part of config.shared ?? []) {
      const loaded = loadPart(root, part, add);
      if (loaded) parts.push(loaded);
    }
  }
  checkOneShot(manifest, folder, name, dir, problems);
  return { id: manifest.id, type: manifest.type, dir, manifest, parts };
}

// A models block is offered on the phone only once CI's local-model check
// runs the kind's one-shot mode with it, so the two come together.
function checkOneShot(manifest, folder, name, dir, problems) {
  const file = `agents/${folder}/${name}/${ONE_SHOT_FILE}`;
  const add = (path, code, detail) => problems.push({ file, path, code, detail });
  if (!existsSync(join(dir, ONE_SHOT_FILE))) {
    if (manifest.models) {
      problems.push({
        file: `agents/${folder}/${name}/agent.json`,
        path: '/models',
        code: 'missing',
        detail: `a kind with a models block needs ${ONE_SHOT_FILE}: the local-model check runs it`,
      });
    }
    return;
  }
  if (!manifest.models) add('', 'unused', `${ONE_SHOT_FILE} is for the local-model check, and the kind has no models block`);
  const json = readJson(join(dir, ONE_SHOT_FILE), file, add);
  if (json === undefined) return;
  for (const p of validateOneShot(json, manifest).problems) add(p.path, p.code, p.detail);
}

function loadPart(root, name, add) {
  const dir = join(root, 'agents', 'shared', name);
  const file = `agents/shared/${name}/${PART_FILE}`;
  if (!existsSync(join(dir, PART_FILE))) {
    add('', 'missing', `shared part ${name} needs agents/shared/${name}/${PART_FILE}`, file);
    return null;
  }
  let part;
  try {
    part = JSON.parse(readFileSync(join(dir, PART_FILE), 'utf8'));
  } catch (error) {
    add('', 'json', error.message, file);
    return null;
  }
  const relPath = new RegExp(PATTERNS.relPath, 'u');
  let faults = 0;
  const bad = (path, code, detail) => {
    faults += 1;
    add(path, code, detail, file);
  };
  if (typeof part !== 'object' || part === null || Array.isArray(part)) {
    bad('', 'type', 'must be an object');
    return null;
  }
  for (const key of Object.keys(part)) if (!PART_FIELDS.includes(key)) bad(`/${key}`, 'unknown', `unknown field ${key}`);
  if (typeof part.into !== 'string' || !relPath.test(part.into)) bad('/into', 'pattern', 'into is a relative folder inside the config');
  const fullOnly = part.fullOnly ?? [];
  if (!Array.isArray(fullOnly) || fullOnly.some((g) => typeof g !== 'string' || !relPath.test(g))) {
    bad('/fullOnly', 'pattern', 'fullOnly is a list of relative globs');
  }
  return faults ? null : { name, dir, into: part.into, fullOnly };
}

// --- runtime plugins -------------------------------------------------------

function scanRuntimes(root, problems) {
  const base = join(root, 'agents', RUNTIMES_FOLDER);
  if (!existsSync(base)) return [];
  const runtimes = [];
  for (const name of readdirSync(base).sort()) {
    const dir = join(base, name);
    if (!statSync(dir).isDirectory()) continue;
    const runtime = loadRuntime(name, dir, problems);
    if (runtime) runtimes.push(runtime);
  }
  return runtimes;
}

function loadRuntime(name, dir, problems) {
  const file = `agents/${RUNTIMES_FOLDER}/${name}/${RUNTIME_FILE}`;
  const add = (path, code, detail) => problems.push({ file, path, code, detail });
  const manifest = readJson(join(dir, RUNTIME_FILE), file, add);
  if (manifest === undefined) return null;
  const result = validateRuntime(manifest);
  for (const p of result.problems) add(p.path, p.code, p.detail);
  if (!result.ok) return null;
  if (manifest.id !== name) add('/id', 'folder-name', `id ${manifest.id} sits in folder ${name}`);
  for (const [family, script] of Object.entries(manifest.install)) {
    const target = join(dir, script);
    if (!(existsSync(target) && statSync(target).isFile())) {
      add(`/install/${family}`, 'missing', `${script} is not a file in agents/${RUNTIMES_FOLDER}/${name}/`);
    }
  }
  return { id: manifest.id, dir, manifest };
}

// What a kind's runtimes must give it: each exists, new enough, and some
// family left that the kind and all of them install on.
function checkNeeds(entry, runtimes, problems) {
  const m = entry.manifest;
  const needs = m.requires?.runtimes ?? [];
  if (needs.length === 0) return;
  const add = (path, code, detail) => problems.push({ file: `agents/${entry.type}/${entry.id}/agent.json`, path, code, detail });
  const found = [];
  needs.forEach((text, i) => {
    const need = parseRuntimeNeed(text);
    const runtime = runtimes.find((r) => r.id === need.id);
    if (!runtime) {
      add(`/requires/runtimes/${i}`, 'missing', `no runtime ${need.id} (agents/${RUNTIMES_FOLDER}/${need.id}/${RUNTIME_FILE})`);
      return;
    }
    if (need.atLeast !== null && need.atLeast > runtime.manifest.provides) {
      add(`/requires/runtimes/${i}`, 'range', `${runtime.id} provides ${runtime.manifest.provides}, under the ${need.atLeast} needed`);
    }
    found.push(runtime);
  });
  const own = m.install?.families;
  (own ?? []).forEach((family, i) => {
    const lacking = found.filter((r) => !r.manifest.families.includes(family)).map((r) => r.id);
    if (lacking.length) add(`/install/families/${i}`, 'mismatch', `${lacking.join(', ')} does not install on ${family}`);
  });
  const left = (own ?? FAMILIES).filter((family) => found.every((r) => r.manifest.families.includes(family)));
  if (found.length === needs.length && left.length === 0) {
    add('/requires/runtimes', 'mismatch', 'no family is left that the kind and every runtime it needs install on');
  }
  for (const family of Object.keys(m.install?.packages ?? {})) {
    if (family !== ANY_FAMILY && found.length === needs.length && !left.includes(family)) {
      add(`/install/packages/${family}`, 'mismatch', `the kind cannot be installed on ${family} (its runtimes do not install there)`);
    }
  }
}

function readJson(abs, file, add) {
  if (!existsSync(abs)) {
    add('', 'missing', `${dirname(file)}/ has no ${file.split('/').at(-1)}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    add('', 'json', error.message);
    return undefined;
  }
}

function unique(entries, problems, key, code) {
  const seen = new Map();
  for (const e of entries) {
    const value = e.manifest[key];
    const first = seen.get(value);
    if (first) {
      problems.push({
        file: `agents/${e.type}/${e.id}/agent.json`,
        path: `/${key}`,
        code,
        detail: `${key} ${value} is also agents/${first.type}/${first.id}'s`,
      });
    } else seen.set(value, e);
  }
}
