#!/usr/bin/env node
// Stages a native agent kind's payload into the app. Every payload.libs[]
// entry of agents/native/<id>/agent.json is copied from the build output
// (`from`) to the per-kind libs dir under its packaged name (`name`; AGP
// packages only *.so jniLibs), made executable, and checked by verify-elf.sh
// when its linkage is system-only (NEEDED system-only; an engine also needs
// INTERP /system/bin/linker64). Next to the libs it writes the stamp
// (stamp.mjs): SHA256SUMS of what it staged, the build's INPUTS (out/INPUTS,
// written by build.mjs or CI; without one the payload counts as outdated) and
// SOURCE (--source, the artifact's own, or "built on this PC <date>").
//
//   node agents/kit/native/stage.mjs <id> <build-out-dir> [dest] [--staged] [--source <text>]
//
// dest defaults to app/modules/phonecando-runner/android/src/agents/<id>/
// libs/arm64-v8a/ (gitignored; agents.gradle adds it to the jniLibs of the
// channels the manifest lists). --staged reads files that already carry their
// packaged names, as in a downloaded <prefix>-payload-arm64 artifact; its
// SHA256SUMS, when there, must match before anything is copied.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, nativeManifests } from '../cli/manifests.mjs';
import { INPUTS_RE } from './inputs.mjs';
import { fileDigest, INPUTS, parseSums, SOURCE, SUMS, sumsText } from './stamp.mjs';

const VERIFY_ELF = join(dirname(fileURLToPath(import.meta.url)), 'verify-elf.sh');

/** Where the app's Gradle build picks up a kind's staged libs. */
export function defaultDest(root, id) {
  return join(root, 'app/modules/phonecando-runner/android/src/agents', id, 'libs/arm64-v8a');
}

/**
 * Copies, renames and chmods every lib of `manifest`, runs the linkage guard,
 * then writes the stamp. Returns [{ name, path, bytes }]; throws an Error
 * starting "STAGE FAIL" when a source is missing, an artifact's lib does not
 * match its SHA256SUMS or a lib fails the guard (the stamp is then gone, so
 * the half-staged payload counts as outdated). `source` overrides SOURCE.
 * `checkLinkage: false` is for tests only (their fake libs are not ELF).
 */
export function stagePayload({ manifest, from, dest, staged = false, source, checkLinkage = true, log = console.log }) {
  const libs = manifest.payload?.libs ?? [];
  if (!libs.length) throw new Error(`STAGE FAIL: ${manifest.id} has no payload.libs`);
  for (const lib of libs) {
    const src = join(from, staged ? lib.name : lib.from);
    if (!existsSync(src) || !statSync(src).isFile()) {
      const hint = staged ? 'artifact incomplete' : `run ./manage agent ${manifest.id} build first`;
      throw new Error(`STAGE FAIL: ${src} missing (${hint})`);
    }
  }
  if (staged) checkArtifactSums(from, libs);
  const stamp = readFromStamp(from, staged, source);
  mkdirSync(dest, { recursive: true });
  for (const name of [SUMS, INPUTS, SOURCE]) rmSync(join(dest, name), { force: true });
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
  writeFileSync(join(dest, SUMS), sumsText(dest, libs.map((lib) => lib.name)));
  if (stamp.inputs) writeFileSync(join(dest, INPUTS), `${stamp.inputs}\n`);
  else log(`--- ${manifest.id}: no INPUTS in ${from}; this payload counts as outdated (build it with ./manage agent ${manifest.id} build) ---`);
  writeFileSync(join(dest, SOURCE), `${stamp.source}\n`);
  for (const { name, bytes } of out) log(`staged ${name} (${bytes} B) -> ${dest}`);
  log(`source: ${stamp.source}${stamp.inputs ? `; inputs ${stamp.inputs.slice(0, 12)}` : ''}`);
  return out;
}

// A downloaded artifact carries the SHA256SUMS CI wrote: a lib that does not
// match it was damaged or swapped on the way.
function checkArtifactSums(from, libs) {
  const path = join(from, SUMS);
  if (!existsSync(path)) return;
  const sums = parseSums(readFileSync(path, 'utf8'));
  if (!sums) throw new Error(`STAGE FAIL: ${path} is not sha256sum output`);
  for (const { name } of libs) {
    if (sums.get(name) !== fileDigest(join(from, name)).sha256) {
      throw new Error(`STAGE FAIL: ${name} does not match the artifact's SHA256SUMS`);
    }
  }
}

function readFromStamp(from, staged, source) {
  const read = (name) => (existsSync(join(from, name)) ? readFileSync(join(from, name), 'utf8').trim() : '');
  const inputs = read(INPUTS);
  const fallback = staged ? 'artifact' : `built on this PC ${new Date().toISOString().slice(0, 10)}`;
  return {
    inputs: INPUTS_RE.test(inputs) ? inputs : null,
    source: (source ?? (read(SOURCE) || fallback)).split('\n')[0],
  };
}

function usage(msg) {
  if (msg) console.error(`stage.mjs: ${msg}`);
  console.error('usage: node agents/kit/native/stage.mjs <id> <build-out-dir> [dest] [--staged] [--source <text>]');
  process.exit(2);
}

function main(argv) {
  const args = [...argv];
  const staged = args.includes('--staged');
  const at = args.indexOf('--source');
  const source = at >= 0 ? args.splice(at, 2)[1] : undefined;
  if (at >= 0 && !source) usage('--source needs a value');
  const [id, from, dest, ...rest] = args.filter((a) => a !== '--staged');
  if (!id || !from || rest.length) usage();
  const kind = nativeManifests(REPO_ROOT).find((e) => e.id === id);
  if (!kind) usage(`no native agent kind "${id}" (agents/native/${id}/agent.json)`);
  try {
    stagePayload({ manifest: kind.manifest, from: resolve(from), dest: resolve(dest ?? defaultDest(REPO_ROOT, id)), staged, source });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
