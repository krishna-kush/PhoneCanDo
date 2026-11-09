// How an image kind is installed into its machine: the runtimes it needs
// (requires.runtimes, plugins in agents/runtimes/), then `install` (the
// packages for the image's family, then sh steps), checked by
// `versionCheck`; `update` runs its own steps on an installed kind. The kit
// renders the script (agents/kit/kotlin/render InstallRenderer), which runs
// each runtime's script, the packages and each step again when it fails, up
// to `install.retries` more times (default 2), so steps must be safe to rerun;
// agents/kit/cli/manifests.mjs checks that the runtimes named exist and
// agree on families.
import { fields, integer, isObject, list, oneOf, record, regex, string, type Add, type Json } from './primitives.ts';
import { ANY_FAMILY, FAMILIES, MAX, PATTERNS } from './rules.ts';
import { guestTemplate } from './templates.ts';

const INSTALL_KEYS = ['families', 'packages', 'steps', 'timeoutSec', 'retries'];

/** A runtime a kind needs: its id, and the lowest major version it takes (null: any). */
export interface RuntimeNeed {
  id: string;
  atLeast: number | null;
}

/** `<id>` or `<id>>=<major>`; null when it is neither. */
export function parseRuntimeNeed(text: string): RuntimeNeed | null {
  if (!new RegExp(PATTERNS.runtimeNeed, 'u').test(text)) return null;
  const [id, bound] = text.split('>=');
  return { id, atLeast: bound === undefined ? null : Number(bound) };
}

/** requires.runtimes: each a runtime need, each runtime named once. */
export function checkRuntimeNeeds(add: Add, runtimes: unknown) {
  const seen = new Set<string>();
  list(add, '/requires/runtimes', runtimes, { min: 0, unique: true }, (path, value) => {
    if (!string(add, path, value, PATTERNS.runtimeNeed, MAX.name)) return;
    const { id } = parseRuntimeNeed(value as string) as RuntimeNeed;
    if (seen.has(id)) add(path, 'unique', `runtime ${id} is named twice`);
    seen.add(id);
  });
}

export function checkInstall(add: Add, m: Json) {
  if ('install' in m) checkInstallBlock(add, m.install);
  if ('update' in m && fields(add, '/update', m.update, ['steps'], ['steps'])) {
    steps(add, '/update/steps', (m.update as Json).steps, 1);
  }
  if ('versionCheck' in m) checkVersionCheck(add, '/versionCheck', m.versionCheck);
  // An install ends in its version check; a kind that is not installed has
  // nothing to update or check, and nothing installs its runtimes.
  if ('install' in m && !('versionCheck' in m)) add('/versionCheck', 'required', 'an install needs a versionCheck');
  for (const key of ['update', 'versionCheck']) {
    if (key in m && !('install' in m)) add('/install', 'required', `${key} needs an install`);
  }
  const needs = isObject(m.requires) && Array.isArray(m.requires.runtimes) ? m.requires.runtimes : [];
  if (needs.length > 0 && !('install' in m)) add('/install', 'required', 'requires.runtimes are installed with the kind, so need an install');
}

/** `{ argv, pattern }`: a guest program and its args ({{home}} only), and a regex whose group 1 is read. */
export function checkVersionCheck(add: Add, at: string, value: unknown): Json | null {
  if (!fields(add, at, value, ['argv', 'pattern'], ['argv', 'pattern'])) return null;
  const v = value as Json;
  if (list(add, `${at}/argv`, v.argv, { min: 1, unique: false }, (path, item) => guestTemplate(add, path, item))) {
    const program = (v.argv as unknown[])[0];
    if (typeof program === 'string' && !new RegExp(PATTERNS.guestTool, 'u').test(program)) {
      add(`${at}/argv/0`, 'pattern', 'a guest command, an absolute guest path or a path under {{home}}');
    }
  }
  regex(add, `${at}/pattern`, v.pattern);
  return v;
}

// Packages are keyed by family, `*` the fallback; a family the kind names
// in `families` is the only kind of key besides `*` then.
function checkInstallBlock(add: Add, install: unknown) {
  if (!fields(add, '/install', install, INSTALL_KEYS, [])) return;
  const i = install as Json;
  const named = list(add, '/install/families', i.families, { min: 1, unique: true }, (path, v) => oneOf(add, path, v, FAMILIES));
  record(add, '/install/packages', i.packages, (path, family, names) => {
    if (family !== ANY_FAMILY && oneOf(add, path, family, FAMILIES) && named && !(i.families as unknown[]).includes(family)) {
      add(path, 'mismatch', `${family} is not in install.families`);
    }
    list(add, path, names, { min: 1, unique: true }, (p, name) => string(add, p, name, PATTERNS.package, MAX.package));
  });
  if ('steps' in i) steps(add, '/install/steps', i.steps, 0);
  integer(add, '/install/timeoutSec', i.timeoutSec, 1, MAX.installSec);
  integer(add, '/install/retries', i.retries, 0, MAX.installRetries);
}

function steps(add: Add, path: string, value: unknown, min: number) {
  list(add, path, value, { min, unique: false }, (p, step) => guestTemplate(add, p, step));
}
