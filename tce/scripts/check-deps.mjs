#!/usr/bin/env node
// Enforces the tce dependency law (tce/AGENTS.md). Zero deps.
//
//   node scripts/check-deps.mjs
//
// LAW is the single source of truth. A new module directory fails until it is
// added here, so every new edge gets a deliberate review. Rules:
//   1. A module imports only the tce modules LAW lists for it (relative paths).
//   2. Bare specifiers (npm packages, node:*, cloudflare:*) only where BARE allows.
//   3. Relative imports carry their extension (.ts / .json): Node runs the
//      sources directly with type stripping, and Metro and esbuild accept it.
//   4. Nothing in tce reaches outside tce except the release facts hosts read
//      and the Worker's mount of the accounts routes (accounts/hosts/cloudflare).
//   5. Outside tce, only the app's telemetry adapter (app/src/engine/telemetry/)
//      imports tce, and only tce/client and tce/core; web/ never imports tce.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TCE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO = resolve(TCE, '..');

// Module -> tce modules it may import (itself is always allowed).
const LAW = {
  core: [],
  client: ['core'],
  testkit: ['core'],
  'stores/memory': ['core'],
  'stores/sql': ['core'],
  'stores/sqlite': ['core', 'stores/sql'],
  'stores/cloudflare': ['core', 'stores/sql'],
  'hosts/node': ['core', 'stores/sqlite'],
  'hosts/cloudflare': ['core', 'stores/cloudflare'],
  scripts: [],
};
// Extra modules test files may import.
const TEST_EXTRA = ['testkit', 'stores/memory', 'stores/sql', 'stores/sqlite'];

// Bare specifier prefixes per module. core/client/testkit/memory/sql stay zero-dep.
const BARE = {
  core: [],
  client: [],
  testkit: ['node:assert', 'node:test'],
  'stores/memory': [],
  'stores/sql': [],
  'stores/sqlite': ['node:'],
  'stores/cloudflare': ['cloudflare:'],
  'hosts/node': ['node:'],
  'hosts/cloudflare': ['cloudflare:'],
  scripts: ['node:'],
};
const TEST_BARE = ['node:'];
// Cloudflare modules' tests may drive wrangler's local emulator (getPlatformProxy, unstable_dev).
const TEST_BARE_BY_MODULE = { 'stores/cloudflare': ['wrangler'], 'hosts/cloudflare': ['wrangler'] };

// Files outside tce that hosts may read (release facts, bundled as JSON).
const OUTSIDE_ALLOWED = {
  // The Worker mounts the accounts routes (accounts/AGENTS.md): their one entry only.
  'hosts/cloudflare': ['app/app.json', 'web/src/data/release.json', 'accounts/hosts/cloudflare/index.ts'],
  'hosts/node': ['app/app.json', 'web/src/data/release.json'],
  scripts: ['app/app.json', 'web/src/data/release.json'],
};

const SKIP = new Set(['node_modules', '.wrangler', 'dist', '.data']);
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
  const rel = relative(TCE, file).split(sep).join('/');
  return MODULES.find((m) => rel === m || rel.startsWith(m + '/')) ?? null;
}

const rel = (p) => relative(REPO, p).split(sep).join('/');

// ---------- inside tce ----------
for (const file of walk(TCE, ['.ts', '.mjs'])) {
  const r = relative(TCE, file).split(sep).join('/');
  if (r.split('/').length === 1) continue; // root config files
  const mod = moduleOf(file);
  if (!mod) {
    errors.push(`${rel(file)}: not in a known module; add its directory to LAW in scripts/check-deps.mjs`);
    continue;
  }
  // Test code: *.test.ts and the shared setup they import, *.test-support.ts.
  const isTest = /\.test(?:-support)?\.ts$/.test(file);
  const allowedMods = new Set([mod, ...LAW[mod], ...(isTest ? TEST_EXTRA : [])]);
  const allowedBare = [...BARE[mod], ...(isTest ? [...TEST_BARE, ...(TEST_BARE_BY_MODULE[mod] ?? [])] : [])];
  for (const spec of specifiers(readFileSync(file, 'utf8'))) {
    if (spec.startsWith('.')) {
      if (!/\.(ts|json|mjs)$/.test(spec)) errors.push(`${rel(file)}: relative import '${spec}' needs its file extension`);
      const target = resolve(dirname(file), spec);
      if (!target.startsWith(TCE + sep)) {
        const outside = rel(target);
        if (!(OUTSIDE_ALLOWED[mod] ?? []).includes(outside)) errors.push(`${rel(file)}: imports '${outside}' outside tce`);
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

// ---------- outside tce ----------
const TELEMETRY_DIR = join(REPO, 'app/src/engine/telemetry') + sep;
const isAdapter = (file) => file.startsWith(TELEMETRY_DIR);
for (const file of [...walk(join(REPO, 'app/src'), ['.ts', '.tsx']), ...walk(join(REPO, 'web/src'), ['.ts', '.astro', '.mjs'])]) {
  for (const spec of specifiers(readFileSync(file, 'utf8'))) {
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    if (!target.startsWith(TCE + sep)) continue;
    const tmod = moduleOf(target);
    if (!isAdapter(file)) errors.push(`${rel(file)}: only the telemetry adapter (app/src/engine/telemetry/) may import tce ('${spec}')`);
    else if (tmod !== 'client' && tmod !== 'core') errors.push(`${rel(file)}: may import only tce/client and tce/core, not ${tmod}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`deps: ${e}`);
  console.error(`\n${errors.length} dependency-law violation(s)`);
  process.exit(1);
}
console.log('deps: tce dependency law holds');
