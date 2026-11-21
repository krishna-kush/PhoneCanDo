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
import { releaseVersion } from '../version.mjs';

const RELEASE_USAGE =
  'usage: manage release <x.y.z>|--major|--minor|--patch [--notes TEXT] [--label alpha|beta] [--publish] [--dry-run] ' +
  '[--upload-only] [--allow-red-ci] [--accept-all] [--without-linux] [--rebuild <ids>] [--download <ids>] [--via-github]';

export function release(args) {
  const [version, rest] = releaseVersion(args, RELEASE_USAGE);
  // Built on GitHub's runners: the checks below run there, not here.
  if (rest.includes('--via-github')) return releaseViaGithub(version, rest.filter((arg) => arg !== '--via-github'));
  const [flags, others] = splitAgentFlags(rest);
  limitsFirst();
  prootFirst(others);
  agentsFirst(others, RELEASED, flags, { release: true });
  heading(`Release v${version}`);
  sh(['node', join(SCRIPTS, 'release-android.mjs'), '--version', version, ...others], { env: releaseEnv() });
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
