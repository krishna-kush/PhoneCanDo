import app from '../../../app/app.json';

// Everything the download UI shows. Update here, nowhere else.
//
// The version comes from the app itself (app/app.json, bumped by
// ./manage release), and every download URL and file name derives from it,
// so the buttons and the curl/adb commands can never name different versions.
const repo = 'https://github.com/krishna-kush/PhoneCanDo';
const releases = `${repo}/releases`;
const version: string = app.expo.version;
const apkFile = (channel: 'lite' | 'full') => `phonecando-${version}-${channel}-arm64.apk`;
const apkUrl = (channel: 'lite' | 'full') => `${releases}/download/v${version}/${apkFile(channel)}`;

// What only a published release knows, written by ./manage release once its
// uploads succeed (scripts/release-android.mjs). It must describe the app
// version above: a page showing one version's links with another's checksum
// would hand people a file that fails its own check.
const published = {
  version: '0.1.2',
  released: '2026-11-03',
  // The starter (lite) APK, the phone download.
  size: '106 MB',
  sha256: 'bd297f20a84aaa8da492268402db6eab05b3d5c5637778be12ea0c9e05abf927',
};

if (published.version !== version) {
  const message =
    `web/src/data/site.ts: the release facts are for v${published.version}, but app/app.json says ` +
    `v${version}. ./manage release ${version} writes them once its uploads succeed.`;
  // A production build must not ship mismatched links and checksum; the dev
  // server only warns, so the site stays editable while a release is pending.
  if (import.meta.env.PROD) throw new Error(message);
  console.warn(message);
}

export const site = {
  name: 'PhoneCanDo',
  tagline: 'AI that can use your phone.',
  repo,
  releases,
  version,
  // Starter (lite) build: the phone download. Full is for adb installs.
  apk: apkUrl('lite'),
  fullApk: apkUrl('full'),
  fullApkFile: apkFile('full'),
  released: published.released,
  arch: 'arm64',
  minAndroid: '8.0',
  size: published.size,
  sha256: published.sha256,
  license: 'Source-available',
  // Hero screen recording. Drop the files in public/ and fill both paths.
  hero: { video: '', poster: '' },
  // Gate screen recording: the in-app biometric prompt. Same deal.
  gate: { video: '', poster: '' },
  // Install walkthrough: starter APK → "Install full build" → the in-app
  // three-step Accessibility guide. Real recording, ~40 s.
  install: { video: '', poster: '' },
};
