#!/usr/bin/env node
// Validates every agent kind and runtime plugin manifest and the folder rules
// (manifests.mjs), and that each native kind's version still names its build
// sources (../native/lock.mjs, payload.lock):
//   node agents/kit/cli/check.mjs [--root <repo>]      (./manage agent check)
// Prints each problem (a GitHub annotation in Actions) and exits 1 if any.
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOCK_FILE, lockProblems } from '../native/lock.mjs';
import { formatProblem, REPO_ROOT, scanManifests } from './manifests.mjs';

export function main(argv, { log = console.log, env = process.env } = {}) {
  const at = argv.indexOf('--root');
  const root = at >= 0 ? resolve(argv[at + 1] ?? '.') : REPO_ROOT;
  const scan = scanManifests({ root });
  const { entries, runtimes } = scan;
  const problems = [...scan.problems];
  for (const kind of entries.filter((e) => e.type === 'native')) {
    const file = `${relative(root, kind.dir)}/${LOCK_FILE}`;
    for (const detail of lockProblems(kind)) problems.push({ file, path: '', code: 'payload-lock', detail });
  }
  for (const p of problems) {
    if (env.GITHUB_ACTIONS === 'true') log(`::error file=${p.file},title=agent manifest::${p.path} ${p.code}: ${p.detail}`);
    else log(`error: ${formatProblem(p)}`);
  }
  const ids = [...entries.map((e) => `${e.type}/${e.id}`), ...runtimes.map((r) => `runtimes/${r.id}`)].join(', ');
  const counted = `${entries.length} kind(s), ${runtimes.length} runtime(s)`;
  if (problems.length) {
    log(`agents: ${problems.length} problem(s) in ${counted}`);
    return 1;
  }
  log(`agents: ${counted} OK${ids ? ` (${ids})` : ''}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
