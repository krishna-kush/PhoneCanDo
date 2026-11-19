#!/usr/bin/env node
// Lists the agent kinds:
//   node agents/kit/cli/list.mjs [--type native|image] [--models] [--matrix] [--capabilities] [--root <repo>]
// --models keeps the kinds with a models block (local-models.yml's legs).
// --capabilities prints what each kind can do, one row per kind
//   (capabilities.mjs: modes, phone tools and their trust, prompt, resume,
//   wake, messages, what Start me again does).
// --matrix prints a GitHub Actions matrix, one row per kind:
//   {"include":[{"id":"opencode","type":"native","prefix":"oc","toolchains":"bun,zig,ndk"}]}
// Otherwise one tab-separated line per kind: id, type, prefix, channels, version.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capabilities, table } from './capabilities.mjs';
import { KIND_FOLDERS, loadManifests, REPO_ROOT } from './manifests.mjs';

export function matrix(entries) {
  return {
    include: entries.map(({ id, type, manifest }) => ({
      id,
      type,
      prefix: manifest.prefix ?? '',
      toolchains: (manifest.build?.toolchains ?? []).join(','),
    })),
  };
}

export function lines(entries) {
  return entries.map(({ id, type, manifest }) =>
    [id, type, manifest.prefix ?? '-', manifest.channels.join(','), manifest.version].join('\t'),
  );
}

export function main(argv, { log = console.log, error = console.error } = {}) {
  const opts = { matrix: false, models: false, capabilities: false, type: null, root: REPO_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--matrix') opts.matrix = true;
    else if (argv[i] === '--models') opts.models = true;
    else if (argv[i] === '--capabilities') opts.capabilities = true;
    else if (argv[i] === '--type') opts.type = argv[(i += 1)];
    else if (argv[i] === '--root') opts.root = resolve(argv[(i += 1)] ?? '.');
    else {
      error(`list.mjs: unexpected argument ${argv[i]}`);
      return 2;
    }
  }
  if (opts.type !== null && !KIND_FOLDERS.includes(opts.type)) {
    error(`list.mjs: --type must be ${KIND_FOLDERS.join('|')}`);
    return 2;
  }
  let entries;
  try {
    entries = loadManifests({ root: opts.root });
  } catch (e) {
    error(e.message);
    return 1;
  }
  if (opts.type) entries = entries.filter((e) => e.type === opts.type);
  if (opts.models) entries = entries.filter((e) => e.manifest.models);
  if (opts.matrix) log(JSON.stringify(matrix(entries)));
  else if (opts.capabilities) for (const line of table(capabilities(entries))) log(line);
  else for (const line of lines(entries)) log(line);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
