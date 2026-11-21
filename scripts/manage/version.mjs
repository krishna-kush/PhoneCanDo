// The version a release names: given as x.y.z, or --major/--minor/--patch
// counted up from the version app/app.json has now.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { die } from './errors.mjs';
import { APP } from './paths.mjs';

export const BUMPS = ['--major', '--minor', '--patch'];

const SEMVER = /^\d+\.\d+\.\d+$/;

/** current x.y.z with one part counted up and the parts after it zeroed. */
export function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === '--major') return `${major + 1}.0.0`;
  if (bump === '--minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The version app/app.json has now. */
export function appVersion() {
  const version = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo?.version;
  if (!SEMVER.test(version ?? '')) die(`app/app.json: expected expo.version x.y.z, found ${version}`);
  return version;
}

/** [version, the other args] from `<x.y.z> ...` or `--major|--minor|--patch ...`, or a usage error. */
export function releaseVersion(args, usage) {
  const bumps = args.filter((arg) => BUMPS.includes(arg));
  const given = args[0] !== undefined && !args[0].startsWith('--') ? args[0] : null;
  if (bumps.length + (given ? 1 : 0) !== 1) die(usage);
  if (given) {
    if (!SEMVER.test(given)) die(`version must be x.y.z, got ${given}`);
    return [given, args.slice(1)];
  }
  // A retry re-uploads the version the first run already counted up to.
  if (args.includes('--upload-only')) die('--upload-only needs the version the first run made: manage release <x.y.z> --upload-only');
  const current = appVersion();
  const version = bumpVersion(current, bumps[0]);
  console.log(`${bumps[0].slice(2)} bump: ${current} -> ${version} (from app/app.json)`);
  return [version, args.filter((arg) => !BUMPS.includes(arg))];
}
