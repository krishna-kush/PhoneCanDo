#!/usr/bin/env node
// Enforces the agents/ dependency law (agents/AGENTS.md). Zero deps.
//
//   node kit/cli/check-deps.mjs [repo-root]      (pnpm -C agents check-deps)
//
// TS, the kit code the app bundles straight from agents/ by relative path
// (deps/ts-law.mjs):
//   1. agents/kit/ts imports only relative `.ts` files: no bare specifiers,
//      since the app bundles it without installing agents/'s packages. Tests
//      may also use node:* and .mjs/.json. Kinds and builtin have no TS.
//   2. A kit module imports only the kit modules TS_KIT_LAW lists, and
//      nothing outside agents/kit/ts.
//   3. Outside agents/: app/src imports agents/kit/ts/contract with
//      `import type` only; only app/src/engine imports agents/kit/ts/manifest;
//      nothing imports agents/{native,image,builtin}; the app bundles nothing
//      else.
// Kotlin, the pure-JVM build the runner depends on (deps/kotlin-law.mjs):
//   4. No Android, AndroidX, Expo, React Native or runner/app imports in
//      agents/**/*.kt, and no Android plugin or host coordinate in its builds.
//   5. kit-api depends on no project and nothing but the Kotlin stdlib; the
//      kit is layered kit-api <- kit-manifest <- kit-render (each only on the
//      ones before it); other kit-* projects depend only on kit-*; a kind only
//      on kit-* (never on another kind or builtin); builtin on kit-* and kinds;
//      kit-cli is a leaf (nothing depends on it, it is never published).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGradle, checkKotlinSources } from './deps/kotlin-law.mjs';
import { checkTsInside, checkTsOutside } from './deps/ts-law.mjs';

/** Checks the repo at `root`; returns `{ errors, notes }`. */
export function checkDeps(root) {
  const results = [checkTsInside, checkTsOutside, checkKotlinSources, checkGradle].map((check) => check(resolve(root)));
  return { errors: results.flatMap((r) => r.errors), notes: results.flatMap((r) => r.notes) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? fileURLToPath(new URL('../../..', import.meta.url));
  const { errors, notes } = checkDeps(root);
  for (const n of notes) console.log(`  ${n}`);
  if (errors.length) {
    for (const e of errors) {
      console.error(`deps: ${e}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::error title=agents dependency law::${e}`);
    }
    console.error(`\n${errors.length} agents dependency-law violation(s)`);
    process.exit(1);
  }
  console.log('deps: agents dependency law holds');
}
