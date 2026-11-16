// What ./manage build and ./manage release run before an APK build: the
// usage checks, proot, and the agent payloads the APK ships.
import { join } from 'node:path';
import { askShow } from '../terminal/ask.mjs';
import { heading, yellow } from '../terminal/style.mjs';
import { CommandFailed, die } from './errors.mjs';
import { releaseEnv } from './env.mjs';
import { NATIVE, ROOT, TCE } from './paths.mjs';
import { run, sh } from './run.mjs';

// The agents step's own flags, each followed by kind ids (a,b); build and
// release pass every other argument on to their script.
const AGENT_FLAGS = ['--rebuild', '--download'];

/** [flags for agentsFirst, the rest] from build or release arguments. */
export function splitAgentFlags(args) {
  const flags = [];
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (!AGENT_FLAGS.includes(args[i])) {
      rest.push(args[i]);
      continue;
    }
    const ids = args[i + 1];
    if (!ids || ids.startsWith('--')) die(`${args[i]} needs agent kind ids, e.g. ${args[i]} opencode`);
    flags.push(args[i], ids);
    i++;
  }
  return [flags, rest];
}

export function limitsFirst() {
  // The free-plan check (tce/scripts/check-limits.mjs) runs on every build;
  // the usage data report (tce/scripts/data.mjs --report, aggregates only)
  // after asking, yes by default. Never blocks: a failure or a missing node
  // only prints a note before the build goes on.
  heading('Usage');
  const steps = [['limits check', 'check-limits.mjs', []]];
  if (askShow('Show the usage data report?')) steps.push(['data report', 'data.mjs', ['--report']]);
  for (const [name, script, args] of steps) {
    try {
      sh(['node', join(TCE, 'scripts', script), ...args], { env: releaseEnv() });
    } catch (error) {
      const why = error instanceof CommandFailed ? 'failed' : `skipped (${error.message})`;
      console.error(yellow(`manage: ${name} ${why}; continuing`));
    }
  }
}

export function prootFirst(args) {
  // Full and lite carry the proot staged in the app. lre/proot/ensure.sh
  // checks it was built from this tree's lre/proot and, after asking,
  // builds and stages one when it is missing or out of date. A dry run only
  // reports; --without-linux ships none and --upload-only builds nothing.
  if (args.includes('--without-linux') || args.includes('--upload-only')) return;
  heading('Linux (proot)');
  const ensure = ['bash', join(ROOT, 'lre', 'proot', 'ensure.sh')];
  if (args.includes('--dry-run')) run([...ensure, '--check'], { env: releaseEnv() });
  else sh(ensure, { env: releaseEnv() });
}

export function agentsFirst(args, channels, flags, { release = false } = {}) {
  // Which agent kinds the APK ships and where each native payload comes
  // from (agents/kit/native/ensure.mjs): the staged one when it is current
  // (built from this tree's pins, patches and build script), else GitHub's
  // build of these sources, else a build on this PC; it asks in a terminal.
  // A dry run only reports; --upload-only builds nothing.
  if (args.includes('--upload-only')) return;
  heading('Agents');
  const ensure = ['node', join(NATIVE, 'ensure.mjs'), ...channels, ...flags, ...(release ? ['--release'] : [])];
  if (args.includes('--dry-run')) run([...ensure, '--check'], { env: releaseEnv() });
  else sh(ensure, { env: releaseEnv() });
}
