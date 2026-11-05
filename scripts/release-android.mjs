#!/usr/bin/env node
// One-command Android release: bump, build full + lite, verify, stage, draft,
// update site. Full is the update target (latest.json); lite is the download
// users start from, since Play Protect blocks full from a browser but lets
// lite install it in place (docs/release/upgrade-test.md).
// Signing secrets stay in the private env file; this script never prints them.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditApk } from './apk-audit.mjs';

process.env.CI = '1'; // expo prebuild: never prompt
process.env.EXPO_NO_GIT_STATUS = '1'; // expo prebuild: never run git

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const APP_JSON = join(APP, 'app.json');
const APP_PKG = join(APP, 'package.json');
const RELEASE_JSON = join(ROOT, 'web/src/data/release.json');
const UPDATES_TS = join(APP, 'src/engine/updates.ts');
const apkFor = (flavor) =>
  join(APP, `android/app/build/outputs/apk/${flavor}/release/app-${flavor}-release.apk`);
const STAGE_ROOT = join(ROOT, 'dist/release');

let args;

try {
  args = parseArgs(process.argv.slice(2));
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function main() {
  const appJsonRaw = readFileSync(APP_JSON, 'utf8');
  const appJson = JSON.parse(appJsonRaw);
  const currentVersion = appJson.expo?.version;
  const currentCode = appJson.expo?.android?.versionCode;
  const appPackage = appJson.expo?.android?.package;
  if (!isSemver(currentVersion) || !Number.isInteger(currentCode)) {
    fail('app/app.json: expected expo.version semver and android.versionCode integer');
  }
  if (typeof appPackage !== 'string' || !appPackage) {
    fail('app/app.json: expected expo.android.package');
  }

  const version = args.version ?? bumpPatch(currentVersion);
  if (!isSemver(version)) fail(`Invalid --version: ${version}`);
  if (compareSemver(version, currentVersion) < 0) {
    fail(`--version ${version} is older than ${currentVersion}`);
  }
  const retry = version === currentVersion;
  const versionCode = retry ? currentCode : currentCode + 1;
  // --upload-only: the APKs are already staged for this version (a build
  // succeeded, an upload timed out). Never rebuild for a network failure.
  if (args.uploadOnly && !retry) {
    fail(`--upload-only needs app.json already at ${version} (it is ${currentVersion})`);
  }

  const repo = process.env.GITHUB_REPO;
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    fail('Set GITHUB_REPO=owner/repo');
  }
  const releaseEnv = process.env.PHONECANDO_RELEASE_ENV;
  if (!releaseEnv || !existsSync(releaseEnv)) {
    fail('Set PHONECANDO_RELEASE_ENV to the private env file');
  }
  // Gradle runs from app/android; keep the env path absolute for both shells.
  process.env.PHONECANDO_RELEASE_ENV = resolve(releaseEnv);

  const signing = checkSigningEnv();
  const tools = findBuildTools(findSdk());

  const notes = args.notes || `Release v${version}`;
  const released = new Date().toISOString().slice(0, 10);
  const apkUrl = `https://github.com/${repo}/releases/download/v${version}/phonecando-${version}-full-arm64.apk`;

  // Site: starter (lite) is the download, full is offered for adb.

  const appPkgRaw = readFileSync(APP_PKG, 'utf8');
  const updatesRaw = readFileSync(UPDATES_TS, 'utf8');
  const appJsonNext = nextAppJson(appJsonRaw, version, versionCode);
  const appPkgNext = nextPackageVersion(appPkgRaw, version);
  const updatesNext = nextRepoText(updatesRaw, repo);

  console.log(`PhoneCanDo release v${version} (code ${versionCode})`);
  console.log(`Repo:    ${repo}`);
  console.log(`Signing: ${signing.storeFile} (alias ${signing.alias})`);
  console.log(`APKs:    ${apkFor('full')}`);
  console.log(`         ${apkFor('lite')}`);
  console.log(`Stage:   ${join(STAGE_ROOT, `v${version}`)}`);

  if (args.dryRun) {
    // Offline by design: gh auth, the release state and the repo's commits
    // are checked only by a real run.
    console.log('Dry run: no files written, no build, no release, no network.');
    console.log(`Assets: phonecando-${version}-full-arm64.apk (latest.json target), phonecando-${version}-lite-arm64.apk (site download)`);
    console.log('File edits OK: app/app.json, app/package.json, app/src/engine/updates.ts');
    console.log('After the uploads: web/src/data/release.json');
    console.log(
      `Manifest: ${JSON.stringify(
        {
          versionCode,
          version,
          apk: apkUrl,
          size: '<after build>',
          sha256: '<after build>',
          notes,
        },
        null,
        2,
      )}`,
    );
    return;
  }

  // GitHub checks come before any file is written and before the 20-minute
  // build. A published release is final: re-running its version would
  // rebuild, overwrite the stage and release.json, and only then fail to upload.
  // A draft is fine; createDraft replaces its assets.
  const tag = `v${version}`;
  assertGhAuth();
  // Publishing a draft creates the tag; GitHub cannot do that in a repo with
  // no commits.
  if (args.publish) assertRepoHasCommits(repo);
  if (releaseState(repo, tag) === 'published') {
    fail(`Release ${tag} is already published in ${repo}; release a new version instead`);
  }

  writeFileSync(APP_JSON, appJsonNext);
  writeFileSync(APP_PKG, appPkgNext);
  writeFileSync(UPDATES_TS, updatesNext);

  const stage = join(STAGE_ROOT, tag);
  mkdirSync(stage, { recursive: true });
  const asset = join(stage, `phonecando-${version}-full-arm64.apk`);
  const liteAsset = join(stage, `phonecando-${version}-lite-arm64.apk`);
  const manifestPath = join(stage, 'latest.json');
  const release = { repo, version, released };

  if (args.uploadOnly) {
    for (const f of [asset, liteAsset, manifestPath]) if (!existsSync(f)) fail(`--upload-only: missing ${f}`);
    verifyApk(asset, tools, appPackage, version, versionCode, 'full');
    verifyApk(liteAsset, tools, appPackage, version, 1, 'lite');
    // The staged full APK may have been rebuilt or replaced since latest.json
    // was written, and lite rejects a download whose size differs: size and
    // SHA-256 always come from the file being uploaded.
    const staged = readManifest(manifestPath);
    if (staged.version !== version || staged.versionCode !== versionCode || staged.apk !== apkUrl) {
      fail(
        `${manifestPath} describes ${staged.version} (${staged.versionCode}) at ${staged.apk}, ` +
          `not ${version} (${versionCode}) at ${apkUrl}`,
      );
    }
    if (args.notes && args.notes !== staged.notes) {
      fail(`--upload-only publishes the staged notes; edit ${manifestPath} to change them`);
    }
    const full = fileDigest(asset);
    writeManifest(manifestPath, { ...staged, ...full });
    createDraft({ version, repo, notes: staged.notes, assets: [asset, liteAsset, manifestPath] });
    const lite = writeRelease(release, liteAsset, full);
    report(asset, full, liteAsset, lite, manifestPath);
    console.log(`Uploaded staged ${tag} assets.`);
    return;
  }

  // Both flavors in one Gradle run: shared libraries compile once.
  buildFlavors(['full', 'lite']);
  // Both must pass before either is staged: full is the update every lite
  // user is offered. Lite: same version string, versionCode 1
  // (withBuildChannel.js), no accessibility service, so a browser install
  // passes Play Protect.
  verifyApk(apkFor('full'), tools, appPackage, version, versionCode, 'full');
  verifyApk(apkFor('lite'), tools, appPackage, version, 1, 'lite');
  copyFileSync(apkFor('full'), asset);
  copyFileSync(apkFor('lite'), liteAsset);
  const full = fileDigest(asset);
  writeManifest(manifestPath, { versionCode, version, apk: apkUrl, ...full, notes });

  createDraft({ version, repo, notes, assets: [asset, liteAsset, manifestPath] });
  // The site links the release assets: write its facts only after every upload.
  const lite = writeRelease(release, liteAsset, full);
  report(asset, full, liteAsset, lite, manifestPath);
  if (!args.publish) {
    console.log('');
    console.log('Draft release ready. Review it, then publish with:');
    console.log(`  gh release edit v${version} --draft=false -R ${repo}`);
  }
}

// Prebuild re-applies the config plugins over the existing android/ so Gradle
// stays incremental (--clean regenerates from scratch); the flavors then build
// in a single Gradle invocation.
function buildFlavors(flavors) {
  // Expo CLI 57 regenerates app/android unless --no-clean is passed; the
  // config plugins replace their blocks on every run, so reuse is safe.
  run('npx', ['expo', 'prebuild', '-p', 'android', '--no-install', args.clean ? '--clean' : '--no-clean'], { cwd: APP });
  const tasks = flavors.map((f) => `assemble${f.charAt(0).toUpperCase()}${f.slice(1)}Release`).join(' ');
  run(
    'bash',
    [
      '-c',
      `set -a; source "$PHONECANDO_RELEASE_ENV"; set +a; ./gradlew ${tasks} --build-cache -PreactNativeArchitectures=arm64-v8a`,
    ],
    { cwd: join(APP, 'android') },
  );
  for (const f of flavors) if (!existsSync(apkFor(f))) fail(`Missing APK after build: ${apkFor(f)}`);
}

function fileDigest(file) {
  return {
    size: statSync(file).size,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  };
}

function readManifest(path) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path}: ${error.message}`);
  }
  if (typeof manifest?.notes !== 'string') fail(`${path}: no notes`);
  return manifest;
}

// latest.json: the update manifest lite and full read from the release.
function writeManifest(path, { versionCode, version, apk, size, sha256, notes }) {
  writeFileSync(path, `${JSON.stringify({ versionCode, version, apk, size, sha256, notes }, null, 2)}\n`);
}

// web/src/data/release.json: what only a published release knows, for the
// site (web/src/data/site.ts derives the version and every download URL from
// app/app.json). Written whole, never edited in place, so nothing else in
// the site can collide with it. Lite is the phone download; full's SHA-256
// is pinned in the computer commands. Both digests come from the files just
// uploaded.
function writeRelease({ repo, version, released }, liteApk, full) {
  const lite = fileDigest(liteApk);
  const facts = { repo, version, released, lite, full };
  writeFileSync(RELEASE_JSON, `${JSON.stringify(facts, null, 2)}\n`);
  return lite;
}

function report(asset, full, liteAsset, lite, manifestPath) {
  const mb = (bytes) => Math.round(bytes / 1024 / 1024);
  console.log('');
  console.log(`Full APK: ${asset}`);
  console.log(`  ${full.size} bytes (${mb(full.size)} MB) sha256 ${full.sha256}`);
  console.log(`Lite APK: ${liteAsset}`);
  console.log(`  ${lite.size} bytes (${mb(lite.size)} MB) sha256 ${lite.sha256}`);
  console.log(`Manifest: ${manifestPath}`);
}

function parseArgs(argv) {
  const out = { dryRun: false, publish: false, uploadOnly: false, clean: false, version: undefined, notes: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--publish') out.publish = true;
    else if (arg === '--upload-only') out.uploadOnly = true;
    else if (arg === '--clean') out.clean = true;
    else if (arg === '--version') {
      i += 1;
      out.version = requireValue(argv, i, '--version');
    } else if (arg === '--notes') {
      i += 1;
      out.notes = requireValue(argv, i, '--notes');
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else fail(`Unknown argument: ${arg}`);
  }
  return out;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
  return value;
}

function usage() {
  console.log(`Usage: node scripts/release-android.mjs [options]

Options:
  --version X.Y.Z   Release version (default: bump patch)
  --notes TEXT      Update dialog and GitHub release notes
  --dry-run         Check env, SDK and file edits without building (offline)
  --publish         Publish the draft after all assets are attached
  --upload-only     Skip the builds; re-audit the staged APKs, refresh
                    latest.json's size/SHA-256 from the staged full APK and
                    upload (retry after a failed upload)
  --clean           Regenerate android/ from scratch before building

Env:
  PHONECANDO_RELEASE_ENV  path to the private signing env file
  GITHUB_REPO             owner/repo for the release
  ANDROID_HOME            Android SDK (or ANDROID_SDK_ROOT)`);
}

function assertRepoHasCommits(repo) {
  const result = spawnSync(
    'gh',
    ['api', `repos/${repo}/commits?per_page=1`, '--jq', 'length'],
    { encoding: 'utf8' },
  );
  if (result.error) fail(`gh: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`gh api repos/${repo}/commits failed: ${(result.stderr || '').trim()}`);
  }
  if (Number(result.stdout.trim()) < 1) {
    fail(`${repo} has no commits; push the code before publishing a release`);
  }
}

function checkSigningEnv() {
  const result = spawnSync(
    'bash',
    [
      '-c',
      'set -a; source "$PHONECANDO_RELEASE_ENV" >/dev/null; set +a; ' +
        'test -n "$PHONECANDO_STORE_FILE" && test -f "$PHONECANDO_STORE_FILE" && ' +
        'test -n "$PHONECANDO_STORE_PASSWORD" && test -n "$PHONECANDO_KEY_PASSWORD" && ' +
        'printf "%s\\n%s\\n" "$PHONECANDO_STORE_FILE" "${PHONECANDO_KEY_ALIAS:-phonecando}"',
    ],
    { encoding: 'utf8', env: process.env },
  );
  if (result.status !== 0) {
    fail(
      'Signing env is incomplete: need PHONECANDO_STORE_FILE, ' +
        'PHONECANDO_STORE_PASSWORD and PHONECANDO_KEY_PASSWORD',
    );
  }
  const [storeFile, alias] = result.stdout.trim().split('\n');
  return { storeFile, alias };
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Android/Sdk'),
    join(homedir(), 'Library/Android/sdk'),
  ].filter(Boolean);
  const sdk = candidates.find((path) => existsSync(join(path, 'build-tools')));
  if (!sdk) fail('Set ANDROID_HOME (or ANDROID_SDK_ROOT) to the Android SDK');
  return sdk;
}

function findBuildTools(sdk) {
  const dir = join(sdk, 'build-tools');
  const versions = readdirSync(dir)
    .filter((version) => /^\d+(\.\d+){1,3}$/.test(version))
    .sort(compareVersionStrings);
  if (!versions.length) fail(`No build-tools under ${dir}`);
  const base = join(dir, versions[versions.length - 1]);
  const apksigner = join(base, 'apksigner');
  const aapt = join(base, 'aapt');
  if (!existsSync(apksigner) || !existsSync(aapt)) {
    fail(`Missing apksigner/aapt in ${base}`);
  }
  return { apksigner, aapt };
}

// Release signer, channel contents and engine (apk-audit.mjs), then the
// package, version and versionCode.
function verifyApk(apk, tools, pkg, version, versionCode, channel) {
  console.log(auditApk(apk, channel, tools));

  const badging = execFileSync(tools.aapt, ['dump', 'badging', apk], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const line = badging.split('\n').find((entry) => entry.startsWith('package: '));
  const match = line?.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
  if (!match) fail('Could not read package info from APK');
  const [, name, code, apkVersion] = match;
  if (name !== pkg) fail(`APK package ${name} != ${pkg}`);
  if (Number(code) !== versionCode) fail(`APK versionCode ${code} != ${versionCode}`);
  if (apkVersion !== version) fail(`APK versionName ${apkVersion} != ${version}`);
  console.log(`Verified ${name} ${apkVersion} (${code})`);
}

function nextAppJson(raw, version, versionCode) {
  let text = replaceOnce(raw, /("version"\s*:\s*")[^"]*(")/, `$1${version}$2`, 'app.json expo.version');
  text = replaceOnce(
    text,
    /("versionCode"\s*:\s*)\d+/,
    `$1${versionCode}`,
    'app.json android.versionCode',
  );
  return text;
}

function nextPackageVersion(raw, version) {
  return replaceOnce(raw, /("version"\s*:\s*")[^"]*(")/, `$1${version}$2`, 'app/package.json version');
}

function nextRepoText(raw, repo) {
  return replaceOnce(raw, /(const REPO = ')[^']*(')/, `$1${repo}$2`, 'updates.REPO');
}

function assertGhAuth() {
  const auth = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  if (auth.error) fail(`gh: ${auth.error.message}`);
  if (auth.status !== 0) fail('gh is not authenticated; run `gh auth login`');
}

// 'missing', 'draft' or 'published'. Any other answer stops the release: a
// state that cannot be read is not a go-ahead.
function releaseState(repo, tag) {
  const view = spawnSync('gh', ['release', 'view', tag, '-R', repo, '--json', 'isDraft'], {
    encoding: 'utf8',
  });
  if (view.error) fail(`gh: ${view.error.message}`);
  if (view.status !== 0) {
    if (/not found|404/i.test(view.stderr || '')) return 'missing';
    fail(`gh release view ${tag} failed: ${(view.stderr || '').trim()}`);
  }
  let isDraft;
  try {
    ({ isDraft } = JSON.parse(view.stdout));
  } catch {
    // Rejected below.
  }
  if (typeof isDraft !== 'boolean') fail(`gh release view ${tag}: unexpected output ${view.stdout.trim()}`);
  return isDraft ? 'draft' : 'published';
}

function createDraft({ version, repo, notes, assets }) {
  const tag = `v${version}`;
  const state = releaseState(repo, tag);
  if (state === 'published') fail(`Release ${tag} already exists and is published`);
  if (state === 'draft') {
    console.log(`Draft ${tag} already exists; replacing its assets.`);
    run('gh', ['release', 'edit', tag, '-R', repo, '--title', `${tag} (alpha)`, '--notes', notes]);
    run('gh', ['release', 'upload', tag, ...assets, '--clobber', '-R', repo]);
  } else {
    run('gh', [
      'release',
      'create',
      tag,
      ...assets,
      '-R',
      repo,
      '--draft',
      '--title',
      `${tag} (alpha)`,
      '--notes',
      notes,
    ]);
  }

  if (args.publish) {
    run('gh', ['release', 'edit', tag, '--draft=false', '-R', repo]);
  }
}

function replaceOnce(text, regex, replacement, label) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const matches = text.match(new RegExp(regex.source, flags));
  if (!matches || matches.length !== 1) {
    fail(`${label}: expected one match, found ${matches?.length ?? 0}`);
  }
  return text.replace(regex, replacement);
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function isSemver(version) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version);
}

function compareSemver(a, b) {
  return compareVersionStrings(a, b);
}

function compareVersionStrings(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function run(command, commandArgs, options = {}) {
  console.log(`$ ${command} ${commandArgs.map(shellQuote).join(' ')}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited ${result.status}`);
}

function shellQuote(value) {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

function fail(message) {
  console.error(`release-android: ${message}`);
  process.exit(1);
}
