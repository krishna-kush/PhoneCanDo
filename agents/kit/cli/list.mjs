#!/usr/bin/env node
// Lists the agent kinds:
//   node agents/kit/cli/list.mjs [--type native|image] [--matrix] [--root <repo>]
// --matrix prints a GitHub Actions matrix, one row per kind:
//   {"include":[{"id":"opencode","prefix":"oc","toolchains":"bun,zig,ndk"}]}
// Otherwise one tab-separated line per kind: id, type, prefix, channels, version.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KIND_FOLDERS, loadManifests, REPO_ROOT } from './manifests.mjs';

export function matrix(entries) {
  return {
    include: entries.map(({ id, manifest }) => ({
      id,
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
  const opts = { matrix: false, type: null, root: REPO_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--matrix') opts.matrix = true;
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
  if (opts.matrix) log(JSON.stringify(matrix(entries)));
  else for (const line of lines(entries)) log(line);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
