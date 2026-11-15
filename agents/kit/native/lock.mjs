#!/usr/bin/env node
// A native kind's version names one set of build sources. payload.lock (in
// agents/native/<id>/, outside build/ so it is not one of them) holds the
// agent.json version and the INPUTS (inputs.mjs) it was cut from; check.mjs
// fails when the sources changed and the version did not, so two different
// builds never carry one name (opencode: bump the .N of
// 2.0.26-android-phonecando.N in pins.env and agent.json).
//
//   node agents/kit/native/lock.mjs <id>     (./manage agent <id> lock)
//
// records the current version and INPUTS; it refuses while the sources moved
// on under an unchanged version.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, nativeManifests } from '../cli/manifests.mjs';
import { inputsDigest } from './inputs.mjs';

export const LOCK_FILE = 'payload.lock';

const HEADER = [
  '# The agent.json version and the build sources (INPUTS, agents/kit/native/inputs.mjs)',
  '# it was cut from. Changed build/ or payload.libs: bump the version, then',
  '# ./manage agent <id> lock. agents/kit/cli/check.mjs keeps the two in step.',
];

/** { version, inputs } from the kind's payload.lock, or null when there is none or it is malformed. */
export function readLock(dir) {
  const path = join(dir, LOCK_FILE);
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#'));
  const match = line?.trim().match(/^(\S+) ([0-9a-f]{64})$/);
  return match ? { version: match[1], inputs: match[2] } : null;
}

/** Problems for one native kind ({ id, dir, manifest }); [] when its lock matches. */
export function lockProblems(kind, digest = inputsDigest(kind.dir, kind.manifest)) {
  const lock = readLock(kind.dir);
  const version = kind.manifest.version;
  const fix = `./manage agent ${kind.id} lock`;
  if (!lock) return [`no valid ${LOCK_FILE}: run ${fix}`];
  if (lock.inputs !== digest && lock.version === version) {
    return [`build sources changed but the version is still ${version}: bump it in agent.json (and pins.env), then ${fix}`];
  }
  if (lock.inputs !== digest || lock.version !== version) {
    return [`${LOCK_FILE} records ${lock.version}, agent.json says ${version}: run ${fix}`];
  }
  return [];
}

/** Writes the kind's payload.lock; throws when the sources changed under the same version. */
export function writeLock(kind, digest = inputsDigest(kind.dir, kind.manifest)) {
  const lock = readLock(kind.dir);
  const version = kind.manifest.version;
  if (lock && lock.inputs !== digest && lock.version === version) {
    throw new Error(`${kind.id}: build sources changed since ${version} was locked; bump the version in agent.json (and pins.env) first`);
  }
  writeFileSync(join(kind.dir, LOCK_FILE), `${HEADER.join('\n')}\n${version} ${digest}\n`);
  return { version, inputs: digest };
}

function main([id, ...rest]) {
  if (!id || rest.length) {
    console.error('usage: node agents/kit/native/lock.mjs <id>');
    process.exit(2);
  }
  const kind = nativeManifests(REPO_ROOT).find((e) => e.id === id);
  if (!kind) {
    console.error(`lock.mjs: no native agent kind "${id}" (agents/native/${id}/agent.json)`);
    process.exit(2);
  }
  try {
    const { version, inputs } = writeLock(kind);
    console.log(`${id}: locked ${version} to sources ${inputs.slice(0, 12)} (agents/native/${id}/${LOCK_FILE})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
