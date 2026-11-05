#!/usr/bin/env node
// Build one release-signed channel APK locally: no version bump, no upload.
//   node scripts/build-android.mjs lite   -> dist/lite/phonecando-<ver>-lite-arm64.apk
//   node scripts/build-android.mjs full   -> dist/full/phonecando-<ver>-full-arm64.apk
// Channels are Gradle product flavors in one project (plugins/withBuildChannel.js),
// so no per-channel prebuild exists. Prebuild re-applies the config plugins
// over the existing android/ so Gradle stays incremental; pass --clean to
// regenerate from scratch (stale-build suspicion, template upgrade).
// Audits the result the same way the release script does (apk-audit.mjs).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditApk } from './apk-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

const channel = process.argv[2];
if (!['lite', 'full'].includes(channel)) fail('usage: build-android.mjs lite|full [--clean]');
process.env.CI = '1'; // expo prebuild: never prompt
process.env.EXPO_NO_GIT_STATUS = '1'; // expo prebuild: never run git
const APK = join(APP, `android/app/build/outputs/apk/${channel}/release/app-${channel}-release.apk`);
const task = `assemble${channel.charAt(0).toUpperCase()}${channel.slice(1)}Release`;
const clean = process.argv.includes('--clean');

const envFile = process.env.PHONECANDO_RELEASE_ENV ?? join(homedir(), '.config/phonecando/release.env');
if (!existsSync(envFile)) fail(`Set PHONECANDO_RELEASE_ENV (no ${envFile})`);
process.env.PHONECANDO_RELEASE_ENV = resolve(envFile);

const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo;
const version = appJson.version;
const expectedCode = channel === 'lite' ? 1 : appJson.android.versionCode;
const tools = buildTools();

// Expo CLI 57 regenerates app/android unless --no-clean is passed.
run('npx', ['expo', 'prebuild', '-p', 'android', '--no-install', clean ? '--clean' : '--no-clean'], { cwd: APP });
run(
  'bash',
  [
    '-c',
    `set -a; source "$PHONECANDO_RELEASE_ENV"; set +a; ./gradlew ${task} --build-cache -PreactNativeArchitectures=arm64-v8a`,
  ],
  { cwd: join(APP, 'android') },
);
if (!existsSync(APK)) fail(`Missing APK: ${APK}`);

let certs;
try {
  certs = auditApk(APK, channel, tools);
} catch (error) {
  fail(error.message);
}
const badging = out(tools.aapt, ['dump', 'badging', APK]);
if (!badging.includes(`versionCode='${expectedCode}'`)) fail(`${channel} versionCode is not ${expectedCode}`);
if (!badging.includes(`versionName='${version}'`)) fail(`versionName is not ${version}`);

const outDir = join(ROOT, 'dist', channel);
mkdirSync(outDir, { recursive: true });
const dest = join(outDir, `phonecando-${version}-${channel}-arm64.apk`);
copyFileSync(APK, dest);
const sha = createHash('sha256').update(readFileSync(dest)).digest('hex');
console.log('');
console.log(certs.trim());
console.log(`APK:     ${dest}`);
console.log(`SHA-256: ${sha}`);
console.log('Done.');

function buildTools() {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), 'Android/Sdk')]
    .filter(Boolean)
    .find((p) => existsSync(join(p, 'build-tools')));
  if (!sdk) fail('Set ANDROID_HOME');
  const dir = join(sdk, 'build-tools');
  const latest = readdirSync(dir)
    .filter((v) => /^\d+(\.\d+)+$/.test(v))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop();
  if (!latest) fail(`No build-tools in ${dir}`);
  return { apksigner: join(dir, latest, 'apksigner'), aapt: join(dir, latest, 'aapt') };
}

function out(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function run(cmd, args, opts) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) fail(`${cmd} exited ${r.status}`);
}

function fail(msg) {
  console.error(`build-android: ${msg}`);
  process.exit(1);
}
