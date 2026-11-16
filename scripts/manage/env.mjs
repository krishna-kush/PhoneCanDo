// The environment release builds run in: signing settings, the repo name and
// the Android SDK's build-tools.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { die } from './errors.mjs';
import { APP, ROOT } from './paths.mjs';

function localEnvFile() {
  // The repo-root .env (gitignored) holds the release signing settings and
  // TCE_READ_TOKEN. The old ~/.config path is used only while .env is absent.
  const local = join(ROOT, '.env');
  const legacy = join(homedir(), '.config/phonecando/release.env');
  return existsSync(local) || !existsSync(legacy) ? local : legacy;
}

export function releaseEnv() {
  const env = { ...process.env };
  env.ANDROID_HOME ??= '/opt/android-sdk';
  env.PHONECANDO_RELEASE_ENV ??= localEnvFile();
  if (!env.GITHUB_REPO) {
    const match = readFileSync(join(APP, 'src/engine/updates.ts'), 'utf8').match(/const REPO = '([^']+)'/);
    if (match) env.GITHUB_REPO = match[1];
  }
  return env;
}

/** The newest build-tools folder of the Android SDK. */
export function buildTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
  const dir = join(sdk, 'build-tools');
  const versions = existsSync(dir) ? readdirSync(dir).filter((name) => /^\d+(\.\d+)+$/.test(name)) : [];
  if (!versions.length) die(`no build-tools under ${dir}`);
  versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return join(dir, versions.at(-1));
}
