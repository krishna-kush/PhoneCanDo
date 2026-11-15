#!/usr/bin/env node
// What decides the bytes of a native agent kind's payload: one sha256 over
// its build/ folder (pins.env, build.sh, patches/) and the payload.libs list
// of its agent.json (which build file becomes which packaged lib). Edits
// anywhere else (docs, ci/, the web adapter) leave it alone.
//
// build.mjs and agent-payload.yml write it to the build's out/INPUTS,
// stage.mjs carries it next to the staged libs, and ensure.mjs and the release
// preflight compare it with this tree's: equal means built from these pins,
// patches and build script.
//
//   node agents/kit/native/inputs.mjs <id>      prints the digest
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, nativeManifests } from '../cli/manifests.mjs';

/** A digest as INPUTS holds it: 64 lowercase hex. */
export const INPUTS_RE = /^[0-9a-f]{64}$/;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

/**
 * The digest for the kind in `folder` (agents/native/<id>/) with `manifest`
 * (its agent.json). Paths are hashed relative to build/ with `/`, sorted by
 * code unit, so every checkout of the same files gives the same digest.
 */
export function inputsDigest(folder, manifest) {
  const build = join(folder, 'build');
  const lines = filesUnder(build)
    .map((path) => [relative(build, path).split(sep).join('/'), path])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([rel, path]) => `${rel}\0${sha256(readFileSync(path))}\n`);
  const libs = (manifest.payload?.libs ?? []).map(({ name, from }) => ({ name, from }));
  lines.push(`payload.libs\0${JSON.stringify(libs)}\n`);
  return sha256(lines.join(''));
}

/** The digest of native kind `id` in the repo at `root`; throws for an unknown id. */
export function kindInputs(id, root = REPO_ROOT) {
  const kind = nativeManifests(root).find((e) => e.id === id);
  if (!kind) throw new Error(`no native agent kind "${id}" (agents/native/${id}/agent.json)`);
  return inputsDigest(kind.dir, kind.manifest);
}

function main([id, ...rest]) {
  if (!id || rest.length) {
    console.error('usage: node agents/kit/native/inputs.mjs <id>');
    process.exit(2);
  }
  try {
    console.log(kindInputs(id));
  } catch (error) {
    console.error(`inputs.mjs: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
