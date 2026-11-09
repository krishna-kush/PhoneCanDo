// The TS import law: the kit code the app bundles straight from agents/ by
// relative path, and who outside agents/ may import it. Kinds have no TS:
// a kind is its manifest, and the app reads it through the runner. Zero deps.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { importsOf, relPath, walk } from './source.mjs';

// kit/ts module -> the kit/ts modules it may import (itself always allowed).
// A new kit/ts folder fails until it gets a row, so every edge is reviewed.
const TS_KIT_LAW = {
  contract: [],
  manifest: [],
};

const CODE = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.astro'];
// Where code outside agents/ could import from it (lre/ and pce/ are JVM/C).
const OUTSIDE_ROOTS = ['app', 'web', 'tce', 'scripts', '.github', 'theme'];
// Folders that hold no TS: kinds are data plus Kotlin hooks.
const NO_TS = 'agents/builtin/ts and agents/{native,image}/<id>/ts';

// The kit/ts module a repo-relative path belongs to, or null.
function kitModule(path) {
  return /^agents\/kit\/ts\/([^/]+)\//.exec(path)?.[1] ?? null;
}

// The TS folders a kind or builtin must not have.
function noTsDirs(agents) {
  const dirs = [join(agents, 'builtin/ts')];
  for (const type of ['native', 'image']) {
    const base = join(agents, type);
    for (const id of existsSync(base) ? readdirSync(base) : []) dirs.push(join(base, id, 'ts'));
  }
  return dirs;
}

// Rules 1-2: imports inside agents/kit/ts, and no TS anywhere a kind lives.
export function checkTsInside(root) {
  const agents = join(root, 'agents');
  const errors = [];
  for (const file of noTsDirs(agents).flatMap((d) => walk(d, CODE))) {
    errors.push(`${relPath(root, file)}: kinds have no TS (${NO_TS}); describe the kind in its agent.json`);
  }
  const files = walk(join(agents, 'kit/ts'), CODE);
  for (const file of files) {
    const path = relPath(root, file);
    const mod = kitModule(path);
    if (!mod) {
      errors.push(`${path}: sits directly in agents/kit/ts; put it in a module folder (kit/ts/<name>/)`);
      continue;
    }
    if (!(mod in TS_KIT_LAW)) {
      errors.push(`${path}: agents/kit/ts/${mod} has no row in TS_KIT_LAW (agents/kit/cli/deps/ts-law.mjs); add its allowed edges`);
      continue;
    }
    // Tests are never bundled: they may also use node:*, .mjs and .json, and
    // import anything in agents/ but a kind (they read manifests as files).
    const isTest = /\.test\.(?:ts|mjs)$/.test(file);
    for (const { spec, line } of importsOf(readFileSync(file, 'utf8'))) {
      const at = `${path}:${line}`;
      if (!spec.startsWith('.')) {
        if (!(isTest && spec.startsWith('node:'))) errors.push(`${at}: bare import '${spec}'; the app bundles this code, so import only relative .ts files`);
        continue;
      }
      if (!(isTest ? /\.(?:ts|mjs|json)$/ : /\.ts$/).test(spec)) {
        errors.push(`${at}: relative import '${spec}' needs its .ts extension`);
      }
      const target = relPath(root, resolve(dirname(file), spec));
      const tmod = kitModule(target);
      if (!target.startsWith('agents/')) errors.push(`${at}: imports '${target}', outside agents/`);
      else if (isTest && !tmod) {
        if (/^agents\/(?:native|image)\//.test(target)) errors.push(`${at}: a kit test must not import a kind (${target}); read its files instead`);
      } else if (!tmod) errors.push(`${at}: imports '${target}', outside agents/kit/ts`);
      else if (tmod !== mod && !TS_KIT_LAW[mod].includes(tmod)) errors.push(`${at}: agents/kit/ts/${mod} must not import agents/kit/ts/${tmod}`);
    }
  }
  return { errors, notes: [`ts: ${files.length} file(s) under agents/kit/ts`] };
}

// Rule 3: imports of agents/ from the rest of the repo.
export function checkTsOutside(root) {
  const errors = [];
  const files = OUTSIDE_ROOTS.flatMap((r) => walk(join(root, r), CODE));
  for (const file of files) {
    const path = relPath(root, file);
    const inApp = path.startsWith('app/src/');
    // What Metro bundles: app/src plus the entry files at app/'s top level.
    const bundled = inApp || /^app\/[^/]+$/.test(path);
    for (const { spec, typeOnly, line } of importsOf(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = relPath(root, resolve(dirname(file), spec));
      if (!target.startsWith('agents/')) continue;
      const at = `${path}:${line}`;
      if (/^agents\/(?:native|image|builtin)\//.test(target)) {
        errors.push(`${at}: imports ${target}; nothing outside agents/ imports a kind or builtin (the app reads kinds through the runner)`);
      } else if (target.startsWith('agents/kit/ts/contract/')) {
        if (!inApp) errors.push(`${at}: only app/src imports agents/kit/ts/contract`);
        else if (!typeOnly) errors.push(`${at}: app/src imports agents/kit/ts/contract with \`import type\` only`);
      } else if (target.startsWith('agents/kit/ts/manifest/')) {
        if (!path.startsWith('app/src/engine/')) errors.push(`${at}: only app/src/engine imports agents/kit/ts/manifest`);
      } else if (bundled) {
        errors.push(`${at}: the app imports ${target}; it may import only agents/kit/ts/contract and agents/kit/ts/manifest`);
      }
    }
  }
  return { errors, notes: [`outside: ${files.length} file(s) under ${OUTSIDE_ROOTS.join(', ')}`] };
}
