#!/usr/bin/env node
// Before `./manage build` and `./manage release` build an APK: which agent
// kinds the channels ship, where each native payload comes from, and making
// each one current (state.mjs). In our order (choose.mjs): the staged payload
// when it is current, else GitHub's build of these sources (github.mjs),
// else a build on this PC (build.mjs). Image kinds ship as data only.
//
//   node agents/kit/native/ensure.mjs [--check | --yes] [--release]
//        [--rebuild <id,...>] [--download <id,...>] <channel>...
//
//   (none)       in a terminal, asks per kind (Enter takes the default);
//                without one, uses current payloads and stops on anything
//                else that --rebuild or --download did not name
//   --yes        no questions: takes each default
//   --check      no questions, nothing changed: prints the state
//   --release    for a release: prefers GitHub's build over one built here
//   --rebuild    build these kinds on this PC even when current
//   --download   take GitHub's build of these kinds even when current
// Exit 0 when every native payload the channels ship is current at the end,
// 1 when not, 2 on a usage error. GitHub is asked through gh (read-only);
// downloads and builds go under dist/agents/<id>/.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, loadManifests } from '../cli/manifests.mjs';
import { buildKind, defaultWork } from './build.mjs';
import { choose } from './choose.mjs';
import { makeGithub } from './github.mjs';
import { inputsDigest } from './inputs.mjs';
import { defaultDest, stagePayload } from './stage.mjs';
import { readStamp } from './stamp.mjs';
import { stagedState } from './state.mjs';
import { bold, dim, red, stateColor, yellow } from './style.mjs';

const CHANNELS = ['full', 'lite', 'play'];
const short = (sha) => (sha ?? '').slice(0, 12);
const day = (iso) => (iso ?? '').slice(0, 10);

/** owner/name: GITHUB_REPO, else the REPO constant the app's updater uses. */
export function repoName(root = REPO_ROOT, env = process.env) {
  if (env.GITHUB_REPO) return env.GITHUB_REPO;
  const file = join(root, 'app/src/engine/updates/manifest.ts');
  const match = existsSync(file) && readFileSync(file, 'utf8').match(/const REPO = '([^']+)'/);
  return match ? match[1] : null;
}

/** One kind's lines and its default action, as printed before the question. */
export function describe(kind, choice) {
  const lines = [`  ${bold(kind.id)}  native  ${kind.manifest.version}  ${dim(`sources ${short(kind.inputs)}`)}`];
  const { staged } = kind;
  const paint = stateColor[staged.state] ?? ((text) => text);
  lines.push(`    staged   ${paint(staged.state)}${staged.source ? ` (${staged.source})` : ''}`);
  for (const why of staged.state === 'outdated' ? staged.why : []) lines.push(dim(`             ${why}`));
  if (kind.builds === null) lines.push(yellow(`    github   could not ask (${kind.buildsError})`));
  else if (!kind.builds.length) {
    lines.push('    github   no trusted build of these sources (a push to prod or a manual run of agent-payload.yml builds one; kept 14 days)');
  }
  else {
    const b = kind.builds[0];
    lines.push(`    github   run ${b.runId} from ${b.sha.slice(0, 7)}, built ${day(b.created)}, kept until ${day(b.expires)}`);
  }
  const picked = choice.actions[choice.pick];
  const next = `    -> ${picked ? label(picked) : `cannot: ${choice.note}`}${picked && choice.note ? ` (${choice.note})` : ''}`;
  lines.push(picked ? bold(next) : red(next));
  return lines;
}

export function label(action) {
  if (action.action === 'keep') return 'use the staged payload';
  if (action.action === 'download') return `download GitHub's build (run ${action.build.runId})`;
  return 'build it on this PC (slow: upstream clones and the full toolchain)';
}

function parseArgs(argv) {
  const opts = { check: false, yes: false, release: false, rebuild: new Set(), download: new Set(), channels: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--yes') opts.yes = true;
    else if (arg === '--release') opts.release = true;
    else if (arg === '--rebuild' || arg === '--download') {
      const ids = (argv[++i] ?? '').split(',').filter(Boolean);
      if (!ids.length) throw new Error(`${arg} needs kind ids (comma-separated)`);
      for (const id of ids) opts[arg.slice(2)].add(id);
    } else if (CHANNELS.includes(arg)) opts.channels.push(arg);
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!opts.channels.length) throw new Error('name the channels the APK is built for (full, lite)');
  if (opts.check && opts.yes) throw new Error('--check and --yes do not go together');
  return opts;
}

async function ask(rl, kind, choice) {
  if (choice.actions.length < 2 || !rl) return choice.pick;
  choice.actions.forEach((a, i) => console.log(`    [${i + 1}] ${label(a)}${i === choice.pick ? ' (default)' : ''}`));
  for (;;) {
    const answer = (await rl.question(`  ${kind.id}: choice [${choice.pick + 1}]: `)).trim();
    if (!answer) return choice.pick;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= choice.actions.length) return n - 1;
  }
}

/**
 * Every kind's pick, asked before any work starts, in `plans`' order; then
 * closes `rl` (null: no questions, the defaults). An open readline keeps the
 * terminal raw, where Ctrl+C is a byte nobody reads, so a download or build
 * run with it open could not be stopped. Ctrl+C at a question quits.
 */
export async function askAll(rl, plans, askOne = ask) {
  rl?.on?.('SIGINT', () => {
    rl.close();
    process.kill(process.pid, 'SIGINT');
  });
  try {
    const picks = [];
    for (const { kind, choice } of plans) picks.push(await askOne(rl, kind, choice));
    return picks;
  } finally {
    rl?.close();
  }
}

function act(kind, action, { root, github, log = console.log }) {
  const dest = defaultDest(root, kind.id);
  if (action.action === 'download') {
    const dir = join(root, 'dist/agents', kind.id, `github-${action.build.runId}`);
    rmSync(dir, { recursive: true, force: true });
    log(`  ${kind.id}: downloading run ${action.build.runId}'s payload into ${dir}`);
    github.download(action.build, kind.manifest, dir);
    const got = readStamp(dir, kind.manifest).inputs;
    if (got !== kind.inputs) throw new Error(`${kind.id}: the download's INPUTS (${short(got) || 'none'}) is not this tree's (${short(kind.inputs)}); not staged`);
    stagePayload({ manifest: kind.manifest, from: dir, dest, staged: true, log });
    rmSync(dir, { recursive: true, force: true });
  } else if (action.action === 'build') {
    const { out } = buildKind({ kind, work: defaultWork(root, kind.id, kind.inputs), log });
    stagePayload({ manifest: kind.manifest, from: out, dest, log });
  }
}

/** Every kind the channels ship: native ones with their state and GitHub's builds. */
export function survey({ root, channels, github }) {
  const all = loadManifests({ root });
  const shipped = all.filter((e) => channels.some((ch) => e.manifest.channels.includes(ch)));
  const native = shipped.filter((e) => e.type === 'native').map((kind) => {
    const inputs = inputsDigest(kind.dir, kind.manifest);
    const staged = stagedState(readStamp(defaultDest(root, kind.id), kind.manifest), inputs);
    let builds = null;
    let buildsError = null;
    if (!github) buildsError = 'no GitHub repo name (GITHUB_REPO)';
    else {
      try {
        builds = github.builds(kind.manifest, inputs);
      } catch (error) {
        buildsError = error.message;
      }
    }
    return { ...kind, inputs, staged, builds, buildsError };
  });
  return { native, image: shipped.filter((e) => e.type === 'image') };
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`ensure.mjs: ${error.message}`);
    process.exit(2);
  }
  const root = REPO_ROOT;
  const repo = repoName(root);
  const github = repo ? makeGithub({ repo }) : null;
  const { native, image } = survey({ root, channels: opts.channels, github });
  for (const id of [...opts.rebuild, ...opts.download]) {
    if (!native.some((k) => k.id === id)) {
      console.error(`ensure.mjs: ${id} is not a native kind ${opts.channels.join('/')} ships`);
      process.exit(2);
    }
  }

  console.log(bold(`Agents in this APK (${opts.channels.join(', ')})`));
  const plans = native.map((kind) => ({ kind, choice: choose(kind, opts) }));
  for (const { kind, choice } of plans) for (const line of describe(kind, choice)) console.log(line);
  if (image.length) {
    console.log(dim(`  image kinds, data only (installed into a machine's Linux when an agent is made): ${image.map((k) => k.id).join(', ')}`));
  }
  console.log('');

  const allCurrent = native.every((kind) => kind.staged.state === 'current');
  const pending = plans.filter(({ choice }) => choice.actions[choice.pick]?.action !== 'keep');
  if (opts.check || !pending.length) process.exit(allCurrent ? 0 : 1);
  const terminal = process.stdin.isTTY && process.stdout.isTTY;
  // What --rebuild and --download named needs no question.
  const asked = ({ kind }) => opts.rebuild.has(kind.id) || opts.download.has(kind.id);
  const told = opts.yes || pending.every(asked);
  if (!told && !terminal) {
    if (allCurrent) process.exit(0); // no one to ask: current payloads are used as they are
    console.error(
      'ensure.mjs: not every agent payload is current; run in a terminal to choose, or name it: ' +
        '--download <ids> (GitHub\'s build) or --rebuild <ids> (a build here)',
    );
    process.exit(1);
  }
  const rl = told ? null : createInterface({ input: process.stdin, output: process.stdout });
  // Every question first, then the work, so Ctrl+C stops a download or build.
  const picks = await askAll(rl, plans);
  let failed = 0;
  plans.forEach(({ kind, choice }, i) => {
    const action = choice.actions[picks[i]];
    if (!action) {
      console.error(red(`  ${kind.id}: ${choice.note}; nothing to stage`));
      failed++;
      return;
    }
    try {
      act(kind, action, { root, github });
    } catch (error) {
      console.error(red(`  ${kind.id}: ${error.message}`));
      failed++;
    }
  });
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
