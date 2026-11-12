import app from '../../../app/app.json';
// What only a published release knows: repo, date, and the size and SHA-256
// of both APKs. ./manage release writes the whole file once its uploads
// succeed (scripts/release-android.mjs); never edit it by hand.
import release from './release.json';

// Everything the download UI shows. Edit here; release.json is the script's.
//
// The version comes from the app itself (app/app.json, bumped by
// ./manage release), and every download URL and file name derives from it,
// so the buttons and the computer commands can never name different versions.
const repo = `https://github.com/${release.repo}`;
const releases = `${repo}/releases`;
const version: string = app.expo.version;
const apkFile = (channel: 'lite' | 'full') => `phonecando-${version}-${channel}-arm64.apk`;
const apkUrl = (channel: 'lite' | 'full') => `${releases}/download/v${version}/${apkFile(channel)}`;

// release.json must describe the app version above: a page showing one
// version's links with another's checksum would hand people a file that
// fails its own check.
if (release.version !== version) {
  const message =
    `web/src/data/release.json is for v${release.version}, but app/app.json says ` +
    `v${version}. ./manage release ${version} writes it once its uploads succeed.`;
  // A production build must not ship mismatched links and checksum; the dev
  // server only warns, so the site stays editable while a release is pending.
  if (import.meta.env.PROD) throw new Error(message);
  console.warn(message);
}

/**
 * The API host: the tce Worker answers /v1/* only here, so every path on the
 * site's own domain stays a page. The one place it is written on the web side
 * (.github/ci/web/check-release.mjs reads it from this line).
 */
export const apiOrigin = 'https://api.phonecando.app';

/** Where the inline page-view beacon posts (Base.astro). */
export const hitUrl = `${apiOrigin}/v1/hit`;

/**
 * Download route on the API host. The Worker (tce/hosts/cloudflare) counts the
 * download without identifying anyone, then redirects to this version's
 * GitHub asset. The computer commands keep the direct GitHub URL, because
 * they pin its SHA-256.
 */
export const dlUrl = (channel: 'lite' | 'full') => `${apiOrigin}/v1/dl/${channel}`;

export const site = {
  name: 'PhoneCanDo',
  tagline: 'AI that can use your phone.',
  repo,
  releases,
  version,
  // Direct GitHub asset URLs. The buttons go through dlUrl() instead; the
  // starter (lite) is the phone download, full is for adb installs.
  apk: apkUrl('lite'),
  fullApk: apkUrl('full'),
  fullApkFile: apkFile('full'),
  // Pinned in the computer commands: they check the download against it.
  fullSha256: release.full.sha256,
  released: release.released,
  arch: 'arm64',
  minAndroid: '8.0',
  // The starter (lite) APK, the phone download.
  size: `${Math.round(release.lite.size / 1024 / 1024)} MB`,
  sha256: release.lite.sha256,
  license: 'Source-available',
  // Where people write to us: hi for anything, support for help with the app.
  email: { hi: 'hi@phonecando.app', support: 'support@phonecando.app' },
  // Hero screen recording. Drop the files in public/ and fill both paths;
  // FIG. 01 holds apart while it loads, then plays it whole
  // (lib/apart/autoplay.ts). loopSeconds only labels the placeholder.
  hero: { video: '', poster: '', loopSeconds: 8 },
  // Gate screen recording: the in-app biometric prompt. Same deal.
  gate: { video: '', poster: '' },
  // Install walkthrough: starter APK → "Install full build" → the in-app
  // three-step Accessibility guide. Real recording, ~40 s.
  install: { video: '', poster: '' },
};
