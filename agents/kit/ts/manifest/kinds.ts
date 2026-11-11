// What a kind needs from its machine (requires), and the rules per type and
// origin. A native kind is ours, in the APK, outside proot. An image kind
// runs in the agent's Linux image, so it needs Linux, and its program is a
// guest command. A user-added kind is an image kind with a TUI the user
// describes: no code hooks, nothing packaged in the APK, no web UI, no PATH
// of its own, never the default, and install and update steps of at most
// 32 KiB each.
import { checkRuntimeNeeds } from './install.ts';
import { fields, isObject, list, oneOf, string, utf8Length, type Add, type Json } from './primitives.ts';
import { CONFIG_NEEDS_DIR, LINUX_NEEDS, MAX, MAX_USER_SCRIPT_BYTES, PATTERNS, USER_RESERVED_ENV } from './rules.ts';

const NATIVE_ONLY = ['prefix', 'payload', 'build'];
const IMAGE_ONLY = ['install', 'update', 'versionCheck'];

export function checkRequires(add: Add, requires: unknown) {
  if (!fields(add, '/requires', requires, ['linux', 'commands', 'runtimes'], [])) return;
  const r = requires as Json;
  oneOf(add, '/requires/linux', r.linux, LINUX_NEEDS);
  list(add, '/requires/commands', r.commands, { min: 0, unique: true }, (path, v) =>
    string(add, path, v, PATTERNS.command, MAX.name),
  );
  checkRuntimeNeeds(add, r.runtimes);
}

export function checkType(add: Add, m: Json) {
  if (m.type === 'native') checkNative(add, m);
  else if (m.type === 'image') checkImage(add, m);
}

function checkNative(add: Add, m: Json) {
  for (const key of NATIVE_ONLY) {
    if (!(key in m)) add(`/${key}`, 'required', `a native kind needs ${key}`);
  }
  for (const key of IMAGE_ONLY) {
    if (key in m) add(`/${key}`, 'forbidden', `${key} is for image kinds only`);
  }
  if (isObject(m.licence)) {
    // A native kind is in the APK, so we always redistribute it.
    if (m.licence.redistributed === false) {
      add('/licence/redistributed', 'const', 'a native kind ships in the APK, so it is redistributed');
    }
    if (!('notice' in m.licence)) add('/licence/notice', 'required', 'a native kind ships its notice file');
  }
}

// The runner starts an image kind's program through the image's shell, so
// argv[0] is a command on the guest PATH or an absolute guest path.
function checkImage(add: Add, m: Json) {
  for (const key of NATIVE_ONLY) {
    if (key in m) add(`/${key}`, 'forbidden', `${key} is for native kinds only`);
  }
  if (!('requires' in m)) add('/requires', 'required', 'an image kind needs requires.linux: required');
  else if (isObject(m.requires)) {
    if (!('linux' in m.requires)) add('/requires/linux', 'required', 'an image kind runs in Linux: required');
    else if (m.requires.linux !== 'required') add('/requires/linux', 'const', 'an image kind runs in Linux: required');
  }
  const launch = isObject(m.engine) && isObject(m.engine.launch) ? m.engine.launch : null;
  const program = launch && Array.isArray(launch.argv) ? launch.argv[0] : undefined;
  if (typeof program === 'string' && !new RegExp(PATTERNS.guestProgram, 'u').test(program)) {
    add('/engine/launch/argv/0', 'pattern', 'an image kind runs a guest command or an absolute guest path');
  }
}

export function checkUser(add: Add, m: Json) {
  if (m.type === 'native') add('/type', 'forbidden', 'a user-added kind is an image kind');
  for (const key of ['payload', 'hooks']) {
    if (key in m) add(`/${key}`, 'forbidden', `a user-added kind has no ${key}`);
  }
  if ('default' in m) add('/default', 'forbidden', 'a user-added kind is never the default');
  if (isObject(m.config)) {
    for (const key of ['dir', ...CONFIG_NEEDS_DIR]) {
      if (key in m.config) add(`/config/${key}`, 'forbidden', 'a user-added kind has no bundled config folder');
    }
  }
  if (!('engine' in m)) add('/engine', 'required', 'a user-added kind runs its TUI: engine.style tui');
  else if (isObject(m.engine) && 'style' in m.engine && m.engine.style !== 'tui') {
    add('/engine/style', 'forbidden', 'a user-added kind runs as a TUI');
  }
  if (isObject(m.surfaces)) {
    if ('web' in m.surfaces) add('/surfaces/web', 'forbidden', 'a user-added kind has no web surface');
    if (m.surfaces.home === 'web') add('/surfaces/home', 'forbidden', 'a user-added kind has no web home');
  }
  const launch = isObject(m.engine) && isObject(m.engine.launch) ? m.engine.launch : null;
  if (launch && isObject(launch.env)) {
    for (const name of Object.keys(launch.env)) {
      if (USER_RESERVED_ENV.includes(name)) add(`/engine/launch/env/${name}`, 'reserved', `${name} is the host's to set`);
    }
  }
  for (const block of ['install', 'update']) {
    const steps = isObject(m[block]) ? (m[block] as Json).steps : undefined;
    if (!Array.isArray(steps) || !steps.every((s) => typeof s === 'string')) continue;
    if (utf8Length(steps.join('\n')) > MAX_USER_SCRIPT_BYTES) {
      add(`/${block}/steps`, 'too-large', `a user-added kind's ${block} steps are at most ${MAX_USER_SCRIPT_BYTES / 1024} KiB`);
    }
  }
}
