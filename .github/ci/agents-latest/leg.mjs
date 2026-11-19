#!/usr/bin/env node
// One leg of agents-latest.yml: an image kind installed at its newest
// release into a fresh machine, as the phone installs it, then its probes
// (agents/image/<id>/probes.json): no sign-in, no model, no secret.
//
//   machine   a container of the local-model check's machine image (MACHINE)
//   install   kit-cli render-install --family apt, run with sh in the
//             machine (HOME /root) as the phone's install job runs it; the
//             version check's line is the version installed
//   seed      the kind's config (full channel) into its config dir and the
//             kit's scripts into .phonecando/bin, as the runner does before
//             a first start (logic/seed.mjs), and the work folder
//   help/run  each probe as the kind's terminal launch runs (kit-cli
//             render-launch: its cwd, its env and the runner's, its runtimes
//             on PATH), the bridge pointing at a port nothing serves and the
//             token a stand-in; help needs its strings, run exit 0 and its
//             strings (logic/probes.mjs)
//   acp       the kind's ACP mode as the runner starts it, sent the runner's
//             initialize; each required path truthy in the answer
//
// A kind with no probes.json is installed and version-checked only.
//
// Usage: node leg.mjs <kind-id> <kit-cli-dir> <scratch>
//   <kit-cli-dir>  kit-cli's installDist tree
// Env: MACHINE (image tag, default phonecando-agents-latest), PROBE_TIMEOUT
//   (seconds per help or run probe, default 120), ACP_TIMEOUT (seconds for
//   the ACP answer, default 180; an adapter may fetch itself on first start).
// Markdown on stdout, a GitHub annotation per failure on stderr,
// <scratch>/results.jsonl one line per check, exit 1 on any failure, 2 on
// bad usage. Needs docker and java.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifests, REPO_ROOT } from '../../../agents/kit/cli/manifests.mjs';
import { agentOf, describeLacking, lacking } from './logic/acp.mjs';
import { label, launchCommand, probeCommand, probeValues, verdict } from './logic/probes.mjs';
import { annotation, details, header, resultLine, row } from './logic/report.mjs';
import { seedPlan } from './logic/seed.mjs';
import { handshake } from './run/handshake.mjs';
import * as machine from './run/machine.mjs';

const USAGE = 'usage: node leg.mjs <kind-id> <kit-cli-dir> <scratch>';
// The bridge as the runner hands it, on a port nothing in the machine serves.
const BRIDGE_URL = 'http://127.0.0.1:9';
const PROBES = 'probes.json';

async function main([id, kitCliDir, scratchArg]) {
  if (!id || !kitCliDir || !scratchArg) return usage();
  const entry = loadManifests().find((e) => e.id === id);
  if (!entry || entry.type !== 'image') return usage(`no agents/image/${id}/agent.json`);
  const kitCli = join(resolve(kitCliDir), 'bin', 'kit-cli');
  const scratch = resolve(scratchArg);
  mkdirSync(scratch, { recursive: true });
  const env = process.env;
  const image = env.MACHINE || 'phonecando-agents-latest';
  const probeSec = Number(env.PROBE_TIMEOUT || 120);
  const acpSec = Number(env.ACP_TIMEOUT || 180);

  const out = header(id);
  const logs = [];
  const results = [];
  const record = (check, ok, secs, detail, log) => {
    results.push({ check, ok, secs, detail });
    out.push(row({ check, ok, secs, detail }));
    if (!ok) {
      if (log) logs.push(details(check, log));
      console.error(annotation(id, check, detail));
    }
    return ok;
  };

  const name = `agents-latest-${id}-${process.pid}`;
  try {
    const up = await machine.start(image, name);
    const ready =
      record(`machine (${image})`, up.code === 0, up.secs, up.code === 0 ? 'up' : 'docker run failed', up.output) &&
      (await install(entry, kitCli, scratch, name, record));
    const launch = ready ? render(kitCli, entry, 'terminal', record) : null;
    if (launch && (await seed(entry, launch, scratch, name, record))) await probe(entry, launch, kitCli, name, { probeSec, acpSec }, record);
  } finally {
    await machine.remove(name);
    writeFileSync(join(scratch, 'results.jsonl'), results.map((r) => `${resultLine(id, r)}\n`).join(''));
    console.log([...out, ...logs].join('\n'));
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

// Each help and run probe, then the ACP one; a kind with none is done.
async function probe(entry, launch, kitCli, name, { probeSec, acpSec }, record) {
  const { probes } = entry;
  if (!probes) {
    record('probes', true, 0, `none (agents/image/${entry.id}/${PROBES}): installed and version-checked only`);
    return;
  }
  const values = probeValues(launch);
  for (const part of ['help', 'run']) {
    for (const p of probes[part] ?? []) {
      const r = await machine.run(name, { ...probeCommand(launch, p, values), cwd: '/root', timeoutSec: probeSec });
      const wrong = verdict(part, p, r);
      record(`${part}: \`${label(p)}\``, !wrong, r.secs, wrong ?? (p.has?.length ? `has ${p.has.join(', ')}` : 'exit 0'), r.output);
    }
  }
  if (probes.acp) await acp(kitCli, entry, probes.acp, name, acpSec, record);
}

// The install script the phone runs, run in the machine; its version line.
async function install(entry, kitCli, scratch, name, record) {
  const check = 'install (kit-cli render-install, apt)';
  // The script on stdout, a note on stderr.
  const rendered = spawnSync(kitCli, ['render-install', '--kind', entry.dir, '--family', 'apt'], { encoding: 'utf8' });
  if (rendered.status !== 0) return record(check, false, 0, 'render-install refused', rendered.stderr);
  const dir = join(scratch, 'install');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  writeFileSync(join(dir, '.ci-install.sh'), rendered.stdout);
  const copied = await machine.copyIn(name, dir, '/root');
  if (copied.code !== 0) return record(check, false, copied.secs, 'docker cp failed', copied.output);
  const limit = entry.manifest.install?.timeoutSec ?? 1800;
  const r = await machine.run(name, { argv: ['sh', '/root/.ci-install.sh'], env: { HOME: '/root' }, cwd: '/root', timeoutSec: limit });
  writeFileSync(join(scratch, 'install.log'), r.output);
  if (r.code !== 0) return record(check, false, r.secs, r.timedOut ? `timed out after ${limit}s` : `exit ${r.code}`, r.output);
  // The version check's output follows its phase line.
  const lines = r.output.split('\n');
  const at = lines.indexOf('@phase verify');
  return record(check, true, r.secs, (at >= 0 && lines[at + 1]) || 'installed');
}

// The kind's launch in that mode (kit-cli render-launch), or null after a failed check.
function render(kitCli, entry, mode, record) {
  const r = spawnSync(kitCli, ['render-launch', '--kind', entry.dir, '--mode', mode, '--bridge-url', BRIDGE_URL], { encoding: 'utf8' });
  if (r.status === 0) return JSON.parse(r.stdout);
  record(`kit-cli render-launch --mode ${mode}`, false, 0, `refused: ${r.stderr}`, r.stderr);
  return null;
}

// The config and kit scripts, staged at their guest paths, copied in whole
// and made root's, as the machine's own user writes them on the phone
// (docker cp keeps our uid). Modes as the runner leaves them whatever our
// umask: folders 755, files 644, the scripts 755 (Gemini CLI reads a system
// settings file only when root owns it and its folders and no one else can
// write them).
async function seed(entry, launch, scratch, name, record) {
  const stage = join(scratch, 'stage');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'root/projects'), { recursive: true });
  const plan = seedPlan({ entry, configDir: launch.configDir, kitBin: launch.kitBin, repo: REPO_ROOT, list: files });
  for (const file of plan) {
    const to = join(stage, file.to);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(file.from, to);
    chmodSync(to, file.exec ? 0o755 : 0o644);
  }
  for (const dir of [stage, ...folders(stage)]) chmodSync(dir, 0o755);
  const seeded = readdirSync(join(stage, 'root')).map((top) => `/root/${top}`);
  const chown = ['sh', '-c', 'chown 0:0 /root && chown -R 0:0 "$@"', 'chown', ...seeded];
  const copied = await machine.copyIn(name, stage, '/');
  const r = copied.code === 0 ? await machine.run(name, { argv: chown, timeoutSec: 60 }) : copied;
  const where = launch.configDir ? `${launch.configDir}, ` : '';
  return record('seed (config, kit scripts)', r.code === 0, r.secs, r.code === 0 ? `${plan.length} files: ${where}${launch.kitBin}` : 'docker cp or chown failed', r.output);
}

async function acp(kitCli, entry, spec, name, acpSec, record) {
  const check = 'acp: initialize';
  const launch = render(kitCli, entry, 'acp', record);
  if (!launch) return;
  const command = launchCommand(launch);
  const argv = machine.execArgv(name, { ...command, cwd: '/root', timeoutSec: acpSec, interactive: true });
  const r = await handshake(argv, { env: machine.execEnv(command.env), timeoutMs: (acpSec + 30) * 1000 });
  if (!r.answer) {
    const why = r.timedOut || r.code === 124 ? `no answer in ${acpSec}s` : `exited ${r.code} before answering`;
    return record(check, false, r.secs, why, r.log);
  }
  if (r.answer.error) {
    const { code, message } = r.answer.error;
    return record(check, false, r.secs, `error ${code}: ${message}`, `${JSON.stringify(r.answer.error)}\n${r.log}`);
  }
  const missing = lacking(r.answer.result, spec.require);
  if (missing.length) {
    return record(check, false, r.secs, `lacks ${describeLacking(missing)}`, `${JSON.stringify(r.answer.result, null, 2)}\n${r.log}`);
  }
  const who = agentOf(r.answer.result);
  return record(check, true, r.secs, `${who ? `${who}: ` : ''}${spec.require.join(', ')}`);
}

// A folder's subfolders, absolute, recursively.
function folders(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(d.parentPath, d.name));
}

// A folder's files, relative to it, recursively.
function files(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    return d.isDirectory() ? files(path, base) : [relative(base, path)];
  });
}

function usage(why) {
  if (why) console.error(`leg.mjs: ${why}`);
  console.error(USAGE);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = await main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack ?? error);
    return 1;
  });
  process.exitCode = typeof code === 'number' ? code : 0;
}
