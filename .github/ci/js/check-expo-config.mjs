#!/usr/bin/env node
// Config-plugin gate without a prebuild. Reads the JSON of
//   expo config --type introspect --json
// which runs every plugin in app/app.json in Expo's introspection mode: the
// manifest and gradle.properties mods are applied in memory (to Expo's
// template when app/android does not exist, as in CI) and nothing is written.
// It then checks the results the product depends on, naming the plugin that
// owns each one:
//
//   extractNativeLibs=true          withExtractNativeLibs (engine exec'd from nativeLibraryDir)
//   loopback cleartext config       withLoopbackCleartext (pair UI on http://127.0.0.1)
//   com.phonecando.channel meta     withBuildChannel (runtime channel source of truth)
//   no a11y service/permission and  withBuildChannel (phone control only via the
//   no SYSTEM_ALERT_WINDOW in base    full flavor overlay; lite/play stay clean)
//   REQUEST_INSTALL_PACKAGES        app.json android.permissions (self-update)
//   reactNativeArchitectures=arm64  withBuildPerf (release APKs are *-arm64.apk)
//   package / version / versionCode app.json (what release-android.mjs bumps)
//
//   node .github/ci/js/check-expo-config.mjs <introspect.json>
import { readFileSync } from 'node:fs';
import { createReport, summary } from './lib.mjs';

const file = process.argv[2];
const r = createReport();
if (!file) {
  r.error('usage: check-expo-config.mjs <introspect.json>');
  r.finish('expo config');
}
const config = JSON.parse(readFileSync(file, 'utf8'));
const mods = config._internal?.modResults?.android;
if (!mods?.manifest || !mods?.gradleProperties) {
  r.error('no android modResults: was this produced by `expo config --type introspect --json`?');
  r.finish('expo config');
}

const rows = [];
function check(what, owner, ok, detail) {
  rows.push(`| ${ok ? '✅' : '❌'} | ${what} | ${owner} |`);
  if (!ok) r.error(`${what} (${owner})${detail ? `: ${detail}` : ''}`, owner.startsWith('app.json') ? 'app/app.json' : `app/plugins/${owner}.js`);
}

const manifest = mods.manifest.manifest;
const app = manifest.application?.[0] ?? {};
const attrs = app.$ ?? {};
const metas = (app['meta-data'] ?? []).map((m) => m.$ ?? {});
const perms = (manifest['uses-permission'] ?? []).map((p) => p.$?.['android:name']);
const services = (app.service ?? []).map((s) => s.$?.['android:name'] ?? '');
const props = Object.fromEntries(
  mods.gradleProperties.filter((p) => p.type === 'property').map((p) => [p.key, p.value]),
);

check(
  'application android:extractNativeLibs="true"',
  'withExtractNativeLibs',
  attrs['android:extractNativeLibs'] === 'true',
  `got ${attrs['android:extractNativeLibs']}`,
);
check(
  'application android:networkSecurityConfig="@xml/network_security_config"',
  'withLoopbackCleartext',
  attrs['android:networkSecurityConfig'] === '@xml/network_security_config',
  `got ${attrs['android:networkSecurityConfig']}`,
);
const channel = metas.filter((m) => m['android:name'] === 'com.phonecando.channel');
check(
  'one com.phonecando.channel meta-data = ${phonecandoChannel}',
  'withBuildChannel',
  channel.length === 1 && channel[0]['android:value'] === '${phonecandoChannel}',
  JSON.stringify(channel),
);
const banned = ['android.permission.BIND_ACCESSIBILITY_SERVICE', 'android.permission.SYSTEM_ALERT_WINDOW'];
check(
  'base manifest has no accessibility/overlay permission',
  'withBuildChannel',
  !perms.some((p) => banned.includes(p)),
  perms.filter((p) => banned.includes(p)).join(', '),
);
check(
  'base manifest declares no com.phonecando.runner.uiauto service',
  'withBuildChannel',
  !services.some((s) => s.startsWith('com.phonecando.runner.uiauto.')),
  services.join(', '),
);
check(
  'uses-permission REQUEST_INSTALL_PACKAGES',
  'app.json android.permissions',
  perms.includes('android.permission.REQUEST_INSTALL_PACKAGES'),
);
check(
  'gradle.properties reactNativeArchitectures=arm64-v8a',
  'withBuildPerf',
  props.reactNativeArchitectures === 'arm64-v8a',
  `got ${props.reactNativeArchitectures}`,
);
check(
  'gradle.properties carries no phonecando.channel/automation keys',
  'withBuildChannel',
  !('phonecando.channel' in props) && !('phonecando.automation' in props),
);
check(
  'android.package com.phonecando.app (installed apps update only to the same id)',
  'app.json expo.android.package',
  config.android?.package === 'com.phonecando.app',
  `got ${config.android?.package}`,
);
check(
  'expo.version is semver and android.versionCode a positive integer',
  'app.json expo.version',
  /^\d+\.\d+\.\d+$/.test(config.version ?? '') &&
    Number.isInteger(config.android?.versionCode) &&
    config.android.versionCode > 0,
  `version ${config.version}, versionCode ${config.android?.versionCode}`,
);

summary(
  [
    '### Expo config plugins (introspection, no prebuild)',
    '',
    `PhoneCanDo ${config.version} (code ${config.android?.versionCode}), SDK ${config.sdkVersion}, ` +
      `${(config.plugins ?? []).length} plugins from app.json.`,
    '',
    '| | Result | Owner |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n'),
);
r.finish('expo config');
