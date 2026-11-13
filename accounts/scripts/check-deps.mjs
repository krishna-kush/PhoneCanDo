#!/usr/bin/env node
// Enforces the accounts dependency law (accounts/AGENTS.md). Zero deps.
//
//   node scripts/check-deps.mjs
//
// LAW is the single source of truth. A new module directory fails until it is
// added here, so every new edge gets a deliberate review. Rules:
//   1. A module imports only the accounts modules LAW lists for it.
//   2. Bare specifiers (npm packages, node:*) only where BARE allows.
//   3. Relative imports carry their extension (.ts / .json / .mjs).
//   4. Nothing in accounts reaches outside accounts.
//   5. Outside accounts, only the Worker that mounts it (tce/hosts/cloudflare/)
//      imports it, and only accounts/hosts/cloudflare/index.ts. The app and
//      the site never import it (the app talks to it over HTTP).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO = resolve(ROOT, '..');

// Module -> accounts modules it may import (itself is always allowed).
const LAW = {
  core: [],
  runtime: ['core'],
  'stores/memory': ['core'],
  'stores/sql': ['core'],
  'stores/d1': ['core', 'stores/sql'],
  'hosts/cloudflare': ['core', 'runtime', 'stores/sql', 'stores/d1'],
  testkit: ['core', 'runtime', 'stores/sql', 'stores/d1'],
  scripts: [],
};
// Extra modules test files may import.
const TEST_EXTRA = ['testkit', 'runtime', 'stores/memory', 'stores/sql', 'stores/d1'];
// Bare specifier prefixes per module. Everything that ships stays zero-dep.
const BARE = {
  core: [],
  runtime: [],
  'stores/memory': [],
  'stores/sql': [],
  'stores/d1': [],
  'hosts/cloudflare': [],
  testkit: ['node:'],
  scripts: ['node:'],
};
const TEST_BARE = ['node:'];

// Outside accounts: who may import it, and which file.
const MOUNT_DIR = join(REPO, 'tce/hosts/cloudflare') + sep;
const MOUNT_ENTRY = join(ROOT, 'hosts/cloudflare/index.ts');
const OUTSIDE_DIRS = ['tce', 'app/src', 'web/src'];

const SKIP = new Set(['node_modules', '.wrangler', 'dist', '.data', '.astro']);
const MODULES = Object.keys(LAW).sort((a, b) => b.length - a.length);
const errors = [];

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function specifiers(src) {
  const s = stripComments(src);
  const out = new Set();
  // Anchored to the start of a statement so strings that mention "import" do not match.
  for (const re of [
    /^\s*(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]) {
    for (const m of s.matchAll(re)) out.add(m[1]);
  }
  return [...out];
}

function moduleOf(file) {
  const r = relative(ROOT, file).split(sep).join('/');
  return MODULES.find((m) => r === m || r.startsWith(m + '/')) ?? null;
}

const rel = (p) => relative(REPO, p).split(sep).join('/');

// ---------- inside accounts ----------
for (const file of walk(ROOT, ['.ts', '.mjs'])) {
  const r = relative(ROOT, file).split(sep).join('/');
  if (r.split('/').length === 1) continue; // root config files
  const mod = moduleOf(file);
  if (!mod) {
    errors.push(`${rel(file)}: not in a known module; add its directory to LAW in scripts/check-deps.mjs`);
    continue;
  }
  const isTest = /\.test(?:-support)?\.ts$/.test(file);
  const allowedMods = new Set([mod, ...LAW[mod], ...(isTest ? TEST_EXTRA : [])]);
  const allowedBare = [...BARE[mod], ...(isTest ? TEST_BARE : [])];
  for (const spec of specifiers(readFileSync(file, 'utf8'))) {
    if (spec.startsWith('.')) {
      if (!/\.(ts|json|mjs)$/.test(spec)) errors.push(`${rel(file)}: relative import '${spec}' needs its file extension`);
      const target = resolve(dirname(file), spec);
      if (!target.startsWith(ROOT + sep)) {
        errors.push(`${rel(file)}: imports '${rel(target)}' outside accounts`);
        continue;
      }
      const tmod = moduleOf(target);
      if (!tmod) errors.push(`${rel(file)}: imports '${spec}', which is not in a known module`);
      else if (!allowedMods.has(tmod)) errors.push(`${rel(file)}: ${mod} must not import ${tmod} ('${spec}')`);
    } else if (!allowedBare.some((p) => spec.startsWith(p))) {
      errors.push(`${rel(file)}: ${mod} must not import package '${spec}'`);
    }
  }
}

// ---------- outside accounts ----------
for (const dir of OUTSIDE_DIRS) {
  for (const file of walk(join(REPO, dir), ['.ts', '.tsx', '.mjs', '.astro'])) {
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = resolve(dirname(file), spec);
      if (!target.startsWith(ROOT + sep)) continue;
      if (!file.startsWith(MOUNT_DIR)) errors.push(`${rel(file)}: only the Worker (tce/hosts/cloudflare/) may import accounts ('${spec}')`);
      else if (target !== MOUNT_ENTRY) errors.push(`${rel(file)}: may import only accounts/hosts/cloudflare/index.ts, not '${rel(target)}'`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`deps: ${e}`);
  console.error(`\n${errors.length} dependency-law violation(s)`);
  process.exit(1);
}
console.log('deps: accounts dependency law holds');
