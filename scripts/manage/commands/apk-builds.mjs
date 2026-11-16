// release and build: the checks every APK build runs first, then the
// release or local build script.
import { join } from 'node:path';
import { heading } from '../../terminal/style.mjs';
import { RELEASED, channelArg } from '../args.mjs';
import { agentsFirst, limitsFirst, prootFirst, splitAgentFlags } from '../before-build.mjs';
import { releaseEnv } from '../env.mjs';
import { die } from '../errors.mjs';
import { SCRIPTS } from '../paths.mjs';
import { sh } from '../run.mjs';

export function release(args) {
  if (!args.length || args[0].startsWith('--')) {
    die(
      'usage: manage release <version> [--notes TEXT] [--publish] [--dry-run] [--upload-only] ' +
        '[--allow-red-ci] [--without-linux] [--rebuild <ids>] [--download <ids>]',
    );
  }
  const [flags, rest] = splitAgentFlags(args.slice(1));
  limitsFirst();
  prootFirst(rest);
  agentsFirst(rest, RELEASED, flags, { release: true });
  heading(`Release v${args[0]}`);
  sh(['node', join(SCRIPTS, 'release-android.mjs'), '--version', args[0], ...rest], { env: releaseEnv() });
}

export function build(args) {
  const channel = channelArg(args);
  if (channel === 'play') die('play is a later feature; build lite or full');
  const [flags, rest] = splitAgentFlags(args.slice(1));
  limitsFirst();
  prootFirst(rest);
  agentsFirst(rest, [channel], flags);
  heading(`Build ${channel}`);
  sh(['node', join(SCRIPTS, 'build-android.mjs'), channel, ...rest], { env: releaseEnv() });
}
