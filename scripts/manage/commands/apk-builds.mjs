// release and build: the checks every APK build runs first, then the
// release or local build script; release --via-github hands it all to
// GitHub's runners (github-release.mjs).
import { join } from 'node:path';
import { heading } from '../../terminal/style.mjs';
import { RELEASED, channelArg } from '../args.mjs';
import { agentsFirst, limitsFirst, prootFirst, splitAgentFlags } from '../before-build.mjs';
import { releaseEnv } from '../env.mjs';
import { die } from '../errors.mjs';
import { releaseViaGithub } from '../github-release.mjs';
import { SCRIPTS } from '../paths.mjs';
import { sh } from '../run.mjs';

export function release(args) {
  if (!args.length || args[0].startsWith('--')) {
    die(
      'usage: manage release <version> [--notes TEXT] [--label alpha|beta] [--publish] [--dry-run] [--upload-only] ' +
        '[--allow-red-ci] [--accept-all] [--without-linux] [--rebuild <ids>] [--download <ids>] [--via-github]',
    );
  }
  // Built on GitHub's runners: the checks below run there, not here.
  if (args.includes('--via-github')) return releaseViaGithub(args[0], args.slice(1).filter((arg) => arg !== '--via-github'));
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
