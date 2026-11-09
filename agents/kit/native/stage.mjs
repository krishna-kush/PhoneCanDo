#!/usr/bin/env node
// Stages a native agent kind's payload into the app. Every payload.libs[]
// entry of agents/native/<id>/agent.json is copied from the build output
// (`from`) to the per-kind libs dir under its packaged name (`name`; AGP
// packages only *.so jniLibs), made executable, and checked by verify-elf.sh
// when its linkage is system-only (NEEDED system-only; an engine also needs
// INTERP /system/bin/linker64).
//
//   node agents/kit/native/stage.mjs <id> <build-out-dir> [dest] [--staged]
//
// dest defaults to app/modules/phonecando-runner/android/src/agents/<id>/
// libs/arm64-v8a/ (gitignored; agents.gradle adds it to the jniLibs of the
// channels the manifest lists). --staged reads files that already carry their
// packaged names, as in a downloaded <prefix>-payload-arm64 artifact.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, nativeManifests } from '../cli/manifests.mjs';

const VERIFY_ELF = join(dirname(fileURLToPath(import.meta.url)), 'verify-elf.sh');

/** Where the app's Gradle build picks up a kind's staged libs. */
export function defaultDest(root, id) {
  return join(root, 'app/modules/phonecando-runner/android/src/agents', id, 'libs/arm64-v8a');
}

/**
 * Copies, renames and chmods every lib of `manifest`, then runs the linkage
 * guard. Returns [{ name, path, bytes }]; throws an Error starting
 * "STAGE FAIL" when a source is missing or a lib fails the guard.
 * `checkLinkage: false` is for tests only (their fake libs are not ELF).
 */
export function stagePayload({ manifest, from, dest, staged = false, checkLinkage = true, log = console.log }) {
  const libs = manifest.payload?.libs ?? [];
  if (!libs.length) throw new Error(`STAGE FAIL: ${manifest.id} has no payload.libs`);
  for (const lib of libs) {
    const src = join(from, staged ? lib.name : lib.from);
    if (!existsSync(src) || !statSync(src).isFile()) {
      const hint = staged ? 'artifact incomplete' : `run ./manage agent ${manifest.id} build first`;
      throw new Error(`STAGE FAIL: ${src} missing (${hint})`);
    }
  }
  mkdirSync(dest, { recursive: true });
  const out = libs.map((lib) => {
    const path = join(dest, lib.name);
    copyFileSync(join(from, staged ? lib.name : lib.from), path);
    chmodSync(path, 0o755);
    return { name: lib.name, path, bytes: statSync(path).size };
  });
  if (checkLinkage) {
    log(`--- ${manifest.id}: linkage guard (NEEDED system-only; an engine's INTERP is linker64) ---`);
    for (const lib of libs.filter((l) => l.linkage === 'system-only')) {
      const args = [VERIFY_ELF, 'linkage', join(dest, lib.name), ...(lib.role === 'engine' ? ['engine'] : [])];
      const run = spawnSync('bash', args, { stdio: 'inherit' });
      if (run.status !== 0) throw new Error(`STAGE FAIL: ${lib.name} failed the linkage guard`);
    }
  }
  for (const { name, bytes } of out) log(`staged ${name} (${bytes} B) -> ${dest}`);
  return out;
}

function usage(msg) {
  if (msg) console.error(`stage.mjs: ${msg}`);
  console.error('usage: node agents/kit/native/stage.mjs <id> <build-out-dir> [dest] [--staged]');
  process.exit(2);
}

function main(argv) {
  const staged = argv.includes('--staged');
  const [id, from, dest, ...rest] = argv.filter((a) => a !== '--staged');
  if (!id || !from || rest.length) usage();
  const kind = nativeManifests(REPO_ROOT).find((e) => e.id === id);
  if (!kind) usage(`no native agent kind "${id}" (agents/native/${id}/agent.json)`);
  try {
    stagePayload({ manifest: kind.manifest, from: resolve(from), dest: resolve(dest ?? defaultDest(REPO_ROOT, id)), staged });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
