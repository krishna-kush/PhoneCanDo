#!/usr/bin/env node
// agent-payload.yml's plan job: which native agent kinds to check and build.
//
//   node .github/ci/agent-payload/plan.mjs [--changed <file>]
//
// Without --changed (schedule, manual runs, pull requests, a push that could
// not be diffed) every native kind is in both lists; the workflow's own
// conditions decide whether build runs at all. With --changed, the push's
// changed paths one per line:
//   build  kinds whose build inputs changed (agent.json, build/, ci/), or all
//          of them when a shared input did (the payload kit, the manifest
//          loader, this workflow and its helpers);
//   check  those, plus kinds with any other change in their folder (docs,
//          the web adapter upstream.sh reads), or all of them when the kit's
//          CLI or manifest types changed.
// Writes check=, build= (matrices shaped like list.mjs --matrix prints) and
// check-any=, build-any= (true|false) to $GITHUB_OUTPUT, plus a summary line.
import { appendFileSync, readFileSync } from 'node:fs';
import { loadManifests } from '../../../agents/kit/cli/manifests.mjs';
import { matrix } from '../../../agents/kit/cli/list.mjs';

const SHARED_BUILD = [
  /^agents\/kit\/native\//,
  /^agents\/kit\/cli\/(?:manifests|list)\.mjs$/,
  /^\.github\/workflows\/agent-payload\.yml$/,
  /^\.github\/ci\/agent-payload\//,
];
const SHARED_CHECK = [/^agents\/kit\/cli\//, /^agents\/kit\/ts\/manifest\//];

const args = process.argv.slice(2);
const at = args.indexOf('--changed');
const changed = at >= 0 ? readFileSync(args[at + 1], 'utf8').split('\n').filter(Boolean) : null;

const rows = matrix(loadManifests().filter((e) => e.type === 'native')).include;
const hit = (patterns) => changed.some((path) => patterns.some((re) => re.test(path)));
const inKind = (id, sub) => changed.some((path) => path.startsWith(`agents/native/${id}/`) && sub.test(path.slice(`agents/native/${id}/`.length)));

let build = rows;
let check = rows;
if (changed) {
  const buildAll = hit(SHARED_BUILD);
  const checkAll = buildAll || hit(SHARED_CHECK);
  build = rows.filter((r) => buildAll || inKind(r.id, /^(?:agent\.json$|build\/|ci\/)/));
  check = rows.filter((r) => checkAll || build.includes(r) || inKind(r.id, /./));
}

const out = (line) => {
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
};
out(`check=${JSON.stringify({ include: check })}`);
out(`build=${JSON.stringify({ include: build })}`);
out(`check-any=${check.length > 0}`);
out(`build-any=${build.length > 0}`);
const names = (list) => (list.length ? list.map((r) => r.id).join(', ') : 'none');
const line = `Kinds to check: **${names(check)}**; to build${changed ? ' for this push' : ''}: **${names(build)}**`;
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
