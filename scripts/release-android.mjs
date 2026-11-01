#!/usr/bin/env node
// One-command Android release: bump, build, verify, stage, draft, update site.
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const APP_JSON = join(APP, 'app.json');
const APP_PKG = join(APP, 'package.json');
const SITE_TS = join(ROOT, 'web/src/data/site.ts');
const UPDATES_TS = join(APP, 'src/engine/updates.ts');
const APK = join(APP, 'android/app/build/outputs/apk/release/app-release.apk');
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

  const repo = process.env.GITHUB_REPO;
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    fail('Set GITHUB_REPO=owner/repo');
  }
  // Publishing a draft creates the tag; GitHub cannot do that in a repo with
  // no commits. Fail before the 20-minute build, not after.
  if (args.publish) assertRepoHasCommits(repo);
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
  const apkUrl = `https://github.com/${repo}/releases/download/v${version}/phonecando-${version}-arm64.apk`;

  const appPkgRaw = readFileSync(APP_PKG, 'utf8');
  const siteRaw = readFileSync(SITE_TS, 'utf8');
  const updatesRaw = readFileSync(UPDATES_TS, 'utf8');
  const appJsonNext = nextAppJson(appJsonRaw, version, versionCode);
  const appPkgNext = nextPackageVersion(appPkgRaw, version);
  const updatesNext = nextRepoText(updatesRaw, repo);
  // Validate the site edit before the build; real size/SHA are filled later.
  nextSiteText(siteRaw, { version, released, size: 0, sha256: '<after build>', apkUrl, repo });

  console.log(`PhoneCanDo release v${version} (code ${versionCode})`);
  console.log(`Repo:    ${repo}`);
  console.log(`Signing: ${signing.storeFile} (alias ${signing.alias})`);
  console.log(`APK:     ${APK}`);
  console.log(`Stage:   ${join(STAGE_ROOT, `v${version}`)}`);

  if (args.dryRun) {
    console.log('Dry run: no files written, no build, no release.');
    console.log('File edits OK: app/app.json, app/package.json, web/src/data/site.ts, app/src/engine/updates.ts');
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

  writeFileSync(APP_JSON, appJsonNext);
  writeFileSync(APP_PKG, appPkgNext);
  writeFileSync(UPDATES_TS, updatesNext);

  run('npx', ['expo', 'prebuild', '-p', 'android', '--clean'], { cwd: APP });
  run(
    'bash',
    [
      '-c',
      'set -a; source "$PHONECANDO_RELEASE_ENV"; set +a; ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a',
    ],
    { cwd: join(APP, 'android') },
  );

  if (!existsSync(APK)) fail(`Missing APK: ${APK}`);
  verifyApk(APK, tools, appPackage, version, versionCode);

  const size = statSync(APK).size;
  const sha256 = createHash('sha256').update(readFileSync(APK)).digest('hex');
  const stage = join(STAGE_ROOT, `v${version}`);
  mkdirSync(stage, { recursive: true });
  const asset = join(stage, `phonecando-${version}-arm64.apk`);
  copyFileSync(APK, asset);
  const manifestPath = join(stage, 'latest.json');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ versionCode, version, apk: apkUrl, size, sha256, notes }, null, 2)}\n`,
  );

  writeFileSync(
    SITE_TS,
    nextSiteText(siteRaw, { version, released, size, sha256, apkUrl, repo }),
  );

  createDraft({ version, repo, notes, asset, manifestPath });

  console.log('');
  console.log(`APK:      ${asset}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Size:     ${size} bytes (${Math.round(size / 1024 / 1024)} MB)`);
  console.log(`SHA-256:  ${sha256}`);
  if (!args.publish) {
    console.log('');
    console.log('Draft release ready. Review it, then publish with:');
    console.log(`  gh release edit v${version} --draft=false -R ${repo}`);
  }
}

function parseArgs(argv) {
  const out = { dryRun: false, publish: false, version: undefined, notes: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--publish') out.publish = true;
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
  --dry-run         Check env, SDK and file edits without building
  --publish         Publish the draft after both assets are attached

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

function verifyApk(apk, tools, pkg, version, versionCode) {
  const certs = execFileSync(tools.apksigner, ['verify', '--print-certs', apk], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  console.log(certs.trim());
  if (/CN=Android Debug/i.test(certs)) {
    fail('APK is signed with the Android debug key; release signing was not applied');
  }

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

function nextSiteText(raw, { version, released, size, sha256, apkUrl, repo }) {
  const sizeLabel = `${Math.round(size / 1024 / 1024)} MB`;
  let text = replaceOnce(raw, /(\brepo:\s*)'[^']*'/, `$1'https://github.com/${repo}'`, 'site.repo');
  text = replaceOnce(
    text,
    /(\breleases:\s*)'[^']*'/,
    `$1'https://github.com/${repo}/releases'`,
    'site.releases',
  );
  text = replaceOnce(text, /(\bapk:\s*)'[^']*'/, `$1'${apkUrl}'`, 'site.apk');
  text = replaceOnce(text, /(\bversion:\s*)'[^']*'/, `$1'${version}'`, 'site.version');
  text = replaceOnce(text, /(\breleased:\s*)'[^']*'/, `$1'${released}'`, 'site.released');
  text = replaceOnce(text, /(\bsize:\s*)'[^']*'/, `$1'${sizeLabel}'`, 'site.size');
  text = replaceOnce(text, /(\bsha256:\s*)'[^']*'/, `$1'${sha256}'`, 'site.sha256');
  return text;
}

function createDraft({ version, repo, notes, asset, manifestPath }) {
  const auth = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  if (auth.error) fail(`gh: ${auth.error.message}`);
  if (auth.status !== 0) fail('gh is not authenticated; run `gh auth login`');

  const tag = `v${version}`;
  const view = spawnSync('gh', ['release', 'view', tag, '-R', repo, '--json', 'isDraft'], {
    encoding: 'utf8',
  });
  if (view.error) fail(`gh: ${view.error.message}`);

  if (view.status === 0) {
    let isDraft = false;
    try {
      isDraft = JSON.parse(view.stdout).isDraft;
    } catch {
      // Fall through to the published-release error.
    }
    if (!isDraft) fail(`Release ${tag} already exists and is published`);
    console.log(`Draft ${tag} already exists; replacing its assets.`);
    run('gh', ['release', 'edit', tag, '-R', repo, '--title', `${tag} (alpha)`, '--notes', notes]);
    run('gh', ['release', 'upload', tag, asset, manifestPath, '--clobber', '-R', repo]);
  } else {
    if (!/not found|404/i.test(view.stderr || '')) {
      fail(`gh release view ${tag} failed: ${(view.stderr || '').trim()}`);
    }
    run('gh', [
      'release',
      'create',
      tag,
      asset,
      manifestPath,
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
