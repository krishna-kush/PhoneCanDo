#!/usr/bin/env node
// Type-checks every accounts module with its own tsconfig, so each layer compiles
// with only the globals it is allowed (core: no Node).
// A new module is picked up as soon as it has a tsconfig.json.
//
//   node scripts/typecheck.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TSC = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const SKIP = new Set(['node_modules', '.wrangler', 'dist', '.data']);

function findConfigs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findConfigs(full, out);
    else if (/^tsconfig(\..+)?\.json$/.test(name) && name !== 'tsconfig.base.json') out.push(full);
  }
  return out;
}

if (!existsSync(TSC)) {
  console.error('typecheck: TypeScript missing; run `pnpm -C accounts install` first');
  process.exit(2);
}

const configs = findConfigs(ROOT).sort();
let failed = 0;
for (const cfg of configs) {
  const rel = relative(ROOT, cfg);
  const r = spawnSync(TSC, ['-p', cfg], { stdio: 'pipe', encoding: 'utf8' });
  if (r.status === 0) {
    console.log(`ok    ${rel}`);
  } else {
    failed++;
    console.log(`FAIL  ${rel}`);
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
  }
}
console.log(`\n${configs.length - failed}/${configs.length} projects type-check`);
process.exit(failed ? 1 : 0);
