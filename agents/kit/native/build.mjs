#!/usr/bin/env node
// Builds a native agent kind's payload on this PC, the way agent-payload.yml
// builds it on GitHub: the kind's ci/sources.sh <workdir> when it has one
// (pinned upstream clones), then build/build.sh <workdir>, then this tree's
// INPUTS (inputs.mjs) into <workdir>/out/INPUTS so stage.mjs stamps it.
//
//   node agents/kit/native/build.mjs <id> [workdir] [--stage] [--force]
//
// workdir defaults to dist/agents/<id>/<first 12 of INPUTS>/: one per set of
// sources, so a build of these sources is found again and not redone unless
// --force. --stage stages the result into the app (stage.mjs). The toolchain
// (NDK, and whatever else the kind's build.sh names) comes from the env.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, nativeManifests } from '../cli/manifests.mjs';
import { inputsDigest } from './inputs.mjs';
import { defaultDest, stagePayload } from './stage.mjs';
import { INPUTS } from './stamp.mjs';

const SOURCES_DONE = '.sources-done';

/** The default workdir for a kind's build of `digest`. */
export function defaultWork(root, id, digest) {
  return join(root, 'dist/agents', id, digest.slice(0, 12));
}

/** True when `out` already holds a build of `digest`: INPUTS equal and every lib's build file there. */
export function builtFrom(out, manifest, digest) {
  const inputs = join(out, INPUTS);
  if (!existsSync(inputs) || readFileSync(inputs, 'utf8').trim() !== digest) return false;
  return (manifest.payload?.libs ?? []).every((lib) => existsSync(join(out, lib.from)));
}

function run(cmd, args, log) {
  log(`$ ${[cmd, ...args].join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`BUILD FAIL: ${[cmd, ...args].join(' ')} exited ${result.status ?? result.signal}`);
}

/**
 * Builds kind `kind` ({ id, dir, manifest } from manifests.mjs) into `work`.
 * Returns { work, out, digest, reused }; throws "BUILD FAIL" errors.
 */
export function buildKind({ kind, work, force = false, log = console.log }) {
  const digest = inputsDigest(kind.dir, kind.manifest);
  const out = join(work, 'out');
  if (!force && builtFrom(out, kind.manifest, digest)) {
    log(`${kind.id}: ${out} already holds a build of these sources (INPUTS ${digest.slice(0, 12)}); --force builds again`);
    return { work, out, digest, reused: true };
  }
  mkdirSync(work, { recursive: true });
  const sources = join(kind.dir, 'ci', 'sources.sh');
  if (existsSync(sources) && !existsSync(join(work, SOURCES_DONE))) {
    run('bash', [sources, work], log);
    writeFileSync(join(work, SOURCES_DONE), `${digest}\n`);
  }
  run('bash', [join(kind.dir, 'build', 'build.sh'), work], log);
  // Edited mid-build, the tree no longer names what was built: no stamp.
  if (inputsDigest(kind.dir, kind.manifest) !== digest) {
    throw new Error(`BUILD FAIL: agents/native/${kind.id}/build or its payload.libs changed during the build; build again`);
  }
  writeFileSync(join(out, INPUTS), `${digest}\n`);
  return { work, out, digest, reused: false };
}

function usage(msg) {
  if (msg) console.error(`build.mjs: ${msg}`);
  console.error('usage: node agents/kit/native/build.mjs <id> [workdir] [--stage] [--force]');
  process.exit(2);
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  for (const flag of flags) if (!['--stage', '--force'].includes(flag)) usage(`unknown flag ${flag}`);
  const [id, workArg, ...rest] = argv.filter((a) => !a.startsWith('--'));
  if (!id || rest.length) usage();
  const kind = nativeManifests(REPO_ROOT).find((e) => e.id === id);
  if (!kind) usage(`no native agent kind "${id}" (agents/native/${id}/agent.json)`);
  try {
    const work = resolve(workArg ?? defaultWork(REPO_ROOT, id, inputsDigest(kind.dir, kind.manifest)));
    const { out } = buildKind({ kind, work, force: flags.has('--force') });
    if (flags.has('--stage')) stagePayload({ manifest: kind.manifest, from: out, dest: defaultDest(REPO_ROOT, id) });
    else console.log(`built ${id} -> ${out}; stage it with ./manage agent ${id} stage ${out}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
