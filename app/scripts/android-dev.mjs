#!/usr/bin/env node
// Dev loop for one channel: `node scripts/android-dev.mjs lite|full|play`.
// Channels are product flavors, so this builds the `<channel>Debug` variant
// and installs it as "PhoneCanDo <Channel> Dev"
// (`com.phonecando.app.<channel>.dev`, plugins/withDevAppId.js).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANNELS = ['full', 'lite', 'play'];
const PACKAGE = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo.android.package;

const channel = process.argv[2];
if (!CHANNELS.includes(channel)) {
  console.error('usage: android-dev.mjs full|lite|play');
  process.exit(2);
}
// Expo never runs git here (AGENTS.md rule 8).
const env = { ...process.env, EXPO_NO_GIT_STATUS: '1' };
const clean = process.argv.includes('--clean');
const passthrough = process.argv.slice(3).filter((a) => a !== '--clean');

const variant = `${channel}Debug`;
// Prebuild re-applies the config plugins over the existing project (seconds)
// and keeps every compiled native library; --clean regenerates from scratch.
// CI=1 only keeps prebuild from prompting: run:android must not see it, or
// Expo starts Metro with reloads disabled.
// Expo CLI 57 deletes and regenerates app/android on every prebuild unless
// --no-clean is passed, so --no-clean is the default here and --clean opts in.
run('npx', ['expo', 'prebuild', '-p', 'android', '--no-install', clean ? '--clean' : '--no-clean'], {
  ...env,
  CI: '1',
});
run('npx', [
  'expo', 'run:android',
  '--variant', variant,
  '--app-id', `${PACKAGE}.${channel}.dev`,
  ...passthrough,
], env);

function run(cmd, args, runEnv) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: APP, env: runEnv, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
