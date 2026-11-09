#!/usr/bin/env node
// Scaffolds a new agent kind from templates/<type>/:
//   node agents/kit/cli/new.mjs <id> --native|--image [--prefix <p>] [--root <repo>]
//                                                     (./manage agent new)
// Writes agents/<type>/<id>/ with every __ID__ and __PREFIX__ filled in. A
// native kind's prefix defaults to the id without dashes. Refuses reserved,
// malformed or taken ids and prefixes, and a folder that already exists; the
// new agent.json must pass the validator before anything is written.
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatProblem, KIND_FOLDERS, REPO_ROOT, scanManifests } from './manifests.mjs';
import { PATTERNS, RESERVED_IDS, RESERVED_PREFIXES } from '../ts/manifest/rules.ts';
import { validate } from '../ts/manifest/validate.ts';

export const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), 'templates');

/** Every file under `dir` as [relative path, absolute path], sorted. */
function filesOf(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesOf(join(dir, e.name), base) : [[relative(base, join(dir, e.name)), join(dir, e.name)]]))
    .sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * Plans and writes agents/<type>/<id>/. Returns the repo-relative paths
 * written; throws an Error naming every reason it refuses.
 */
export function scaffold({ id, type, prefix, root = REPO_ROOT }) {
  const errors = [];
  if (!KIND_FOLDERS.includes(type)) errors.push(`type must be ${KIND_FOLDERS.join('|')}`);
  if (!new RegExp(PATTERNS.name, 'u').test(id ?? '')) errors.push(`id "${id}" must match ${PATTERNS.name}`);
  if (RESERVED_IDS.includes(id)) errors.push(`id "${id}" is reserved (${RESERVED_IDS.join(', ')})`);
  const { entries } = scanManifests({ root });
  if (entries.some((e) => e.id === id)) errors.push(`id "${id}" is taken`);
  const dest = join(root, 'agents', type, id ?? '');
  if (id && existsSync(dest)) errors.push(`${relative(root, dest)}/ already exists`);
  let pre = '';
  if (type === 'native') {
    pre = prefix ?? (id ?? '').replaceAll('-', '');
    if (!new RegExp(PATTERNS.prefix, 'u').test(pre)) errors.push(`prefix "${pre}" must match ${PATTERNS.prefix}`);
    if (RESERVED_PREFIXES.includes(pre)) errors.push(`prefix "${pre}" is reserved (${RESERVED_PREFIXES.join(', ')})`);
    const holder = entries.find((e) => e.manifest.prefix === pre);
    if (holder) errors.push(`prefix "${pre}" is ${holder.id}'s`);
  } else if (prefix !== undefined) {
    errors.push('--prefix is for native kinds only');
  }
  if (errors.length) throw new Error(errors.join('\n'));

  const fill = (text) => text.replaceAll('__ID__', id).replaceAll('__PREFIX__', pre);
  const files = filesOf(join(TEMPLATES, type)).map(([rel, abs]) => ({
    rel,
    text: fill(readFileSync(abs, 'utf8')),
    mode: statSync(abs).mode & 0o777,
  }));
  const manifest = JSON.parse(files.find((f) => f.rel === 'agent.json').text);
  const result = validate(manifest, { origin: 'bundled' });
  if (!result.ok) {
    const file = `agents/${type}/${id}/agent.json`;
    throw new Error(result.problems.map((p) => formatProblem({ file, ...p })).join('\n'));
  }
  for (const { rel, text, mode } of files) {
    const path = join(dest, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    chmodSync(path, mode);
  }
  return files.map(({ rel }) => relative(root, join(dest, rel)));
}

export function main(argv, { log = console.log, error = console.error } = {}) {
  const opts = { root: REPO_ROOT };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--native' || argv[i] === '--image') {
      if (opts.type) rest.push(argv[i]);
      opts.type = argv[i].slice(2);
    } else if (argv[i] === '--prefix') opts.prefix = argv[(i += 1)] ?? '';
    else if (argv[i] === '--root') opts.root = resolve(argv[(i += 1)] ?? '.');
    else rest.push(argv[i]);
  }
  if (rest.length !== 1 || !opts.type) {
    error('usage: node agents/kit/cli/new.mjs <id> --native|--image [--prefix <p>] [--root <repo>]');
    return 2;
  }
  try {
    const written = scaffold({ id: rest[0], type: opts.type, prefix: opts.prefix, root: opts.root });
    for (const path of written) log(`created ${path}`);
    log(`next: fill in the TODOs (agents/${opts.type}/${rest[0]}/README.md), then ./manage agent check`);
    return 0;
  } catch (e) {
    error(`new.mjs: ${e.message.replaceAll('\n', '\nnew.mjs: ')}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
