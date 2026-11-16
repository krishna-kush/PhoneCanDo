// agent: the kit's CLI (agents/kit/cli/) for list/check/new, the payloads'
// ensure step (agents/kit/native/ensure.mjs) for status and sync (status
// only reports, sync makes them current, as build does first), and <id>
// build|stage|lock|test on one kind. The ids new/list/check/status/sync/kit
// are reserved, so they never shadow a kind.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CHANNELS, RELEASED } from '../args.mjs';
import { splitAgentFlags } from '../before-build.mjs';
import { releaseEnv } from '../env.mjs';
import { die } from '../errors.mjs';
import { AGENT_KIT, AGENTS, NATIVE } from '../paths.mjs';
import { sh } from '../run.mjs';

const USAGE =
  'usage: manage agent list|check | status|sync [channel...] | new <id> --native|--image | <id> build|stage|lock|test [args]';

/** id -> { folder, native } for every agents/<native|image>/<id>/agent.json. */
export function agentKinds() {
  const kinds = {};
  for (const type of ['image', 'native']) {
    const dir = join(AGENTS, type);
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir).sort()) {
      if (existsSync(join(dir, id, 'agent.json'))) kinds[id] = { folder: join(dir, id), native: type === 'native' };
    }
  }
  return kinds;
}

export function agent(args) {
  if (!args.length) die(USAGE);
  const [first, ...more] = args;
  if (first === 'list' || first === 'check') return sh(['node', join(AGENT_KIT, 'cli', `${first}.mjs`), ...more]);
  if (first === 'status' || first === 'sync') return payloads(first, more);
  if (first === 'new') {
    if (args.length < 3 || (!args.includes('--native') && !args.includes('--image'))) {
      die('usage: manage agent new <id> --native|--image [--prefix <p>]');
    }
    return sh(['node', join(AGENT_KIT, 'cli', 'new.mjs'), ...more]);
  }
  const kinds = agentKinds();
  const [action, ...rest] = more;
  if (!kinds[first] || !['build', 'stage', 'lock', 'test'].includes(action)) {
    die(`${USAGE}; kinds: ${Object.keys(kinds).join(', ') || 'none'}`);
  }
  const { folder, native } = kinds[first];
  if (action !== 'test' && !native) die(`${first} is an image kind: it installs into the Linux image, nothing to ${action}`);
  if (action === 'build') sh(['node', join(NATIVE, 'build.mjs'), first, ...rest]);
  else if (action === 'stage') {
    if (!rest.length) die(`usage: manage agent ${first} stage <build-out> [dest]`);
    sh(['node', join(NATIVE, 'stage.mjs'), first, ...rest]);
  } else if (action === 'lock') sh(['node', join(NATIVE, 'lock.mjs'), first]);
  else {
    if (existsSync(join(folder, 'kotlin', 'build.gradle.kts'))) sh([join(AGENTS, 'gradlew'), `:${first}:test`], { cwd: AGENTS });
    sh(['pnpm', 'test'], { cwd: AGENTS });
  }
}

function payloads(action, args) {
  const [flags, named] = splitAgentFlags(args);
  const channels = named.length ? named : RELEASED;
  if (channels.some((ch) => !CHANNELS.includes(ch)) || (flags.length && action === 'status')) {
    die('usage: manage agent status [channel...] | sync [channel...] [--rebuild <ids>] [--download <ids>]');
  }
  const check = action === 'status' ? ['--check'] : [];
  sh(['node', join(NATIVE, 'ensure.mjs'), ...check, ...channels, ...flags], { env: releaseEnv() });
}
