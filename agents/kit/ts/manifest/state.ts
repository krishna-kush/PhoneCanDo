// An agent's global instructions file (`instructions`, relative to HOME) and
// its own state folder (`state`). The runner writes the image's OS note and
// who else is on the machine into the instructions file. Agents share a
// machine; a second agent of the same kind is allowed only when the kind can
// keep each agent's sign-in, settings, chats and instructions apart: its
// `state.env` moves them into the agent's folder ({{stateDir}}, that env's
// one placeholder, never HOME), the instructions file moves to
// `state.instructions`, and `config.into` to `state.config` when it holds
// the agent's state. An instructions file inside config.into is seeded with
// the config, so it moves with it. `userState` names where the kind keeps
// that state by default, for the host to delete when an agent that used
// the defaults leaves a machine that stays: never anything the machine's
// other agents share.
import { fields, isObject, list, record, relPath, string, type Add, type Json } from './primitives.ts';
import { MAX, PATTERNS, SHARED_HOME, SHARED_HOME_PARENTS, STATE_PLACEHOLDER } from './rules.ts';

const STATE_KEYS = ['env', 'instructions', 'config'];
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export function checkState(add: Add, m: Json) {
  if ('instructions' in m) relPath(add, '/instructions', m.instructions);
  if ('userState' in m) checkUserState(add, m.userState);
  if (!('state' in m) || !fields(add, '/state', m.state, STATE_KEYS, ['env'])) return;
  const s = m.state as Json;
  if ('env' in s) checkEnv(add, s.env);
  for (const key of ['instructions', 'config']) {
    if (key in s) relPath(add, `/state/${key}`, s[key]);
  }
  if ('instructions' in m && !('instructions' in s)) {
    add('/state/instructions', 'required', "the kind has instructions, so an agent's own folder holds them");
  }
  if (!('instructions' in m) && 'instructions' in s) {
    add('/state/instructions', 'forbidden', 'a kind without instructions has none to move');
  }
  if ('config' in s && !('config' in m)) add('/state/config', 'forbidden', 'only a kind with a config has config.into to move');
  checkConfigInstructions(add, m, s);
}

// The instructions file in config.into is seeded with the config, so the
// state folder moves both, the file to the same place in state.config.
function checkConfigInstructions(add: Add, m: Json, s: Json) {
  const into = isObject(m.config) && typeof m.config.into === 'string' ? m.config.into : null;
  const file = typeof m.instructions === 'string' ? m.instructions : null;
  if (into === null || file === null || !file.startsWith(`${into}/`)) return;
  if (!('config' in s)) {
    add('/state/config', 'required', `the instructions file is in config.into (${into}), so config moves with it`);
    return;
  }
  const want = `${s.config}/${file.slice(into.length + 1)}`;
  if (typeof s.config === 'string' && typeof s.instructions === 'string' && s.instructions !== want) {
    add('/state/instructions', 'mismatch', `must be ${want}: the file's place in config.into, in state.config`);
  }
}

function checkUserState(add: Add, paths: unknown) {
  list(add, '/userState', paths, { min: 1, unique: true }, (path, value) => {
    if (!string(add, path, value, PATTERNS.relPath, MAX.relPath)) return;
    const shared = sharedPlace(value as string);
    if (shared) add(path, 'forbidden', `${value} would take ${shared}, which the machine's agents share`);
  });
}

/** The shared place in HOME that deleting `path` would take, or null. */
export function sharedPlace(path: string): string | null {
  const within = (inner: string, outer: string) => inner === outer || inner.startsWith(`${outer}/`);
  return (
    SHARED_HOME.find((s) => within(s, path) || within(path, s)) ??
    SHARED_HOME_PARENTS.find((s) => within(s, path)) ??
    null
  );
}

function checkEnv(add: Add, env: unknown) {
  const ok = record(add, '/state/env', env, (path, name, value) => {
    if (string(add, path, name, PATTERNS.envName, MAX.envName) && new RegExp(PATTERNS.envReserved, 'u').test(name)) {
      add(path, 'reserved', `${name} is the host's to set`);
    }
    stateTemplate(add, path, value);
  });
  if (!ok) return;
  const values = Object.values(env as Json);
  if (values.length === 0) add('/state/env', 'length', "names at least one variable: it moves the kind's state");
  else if (!values.some((v) => typeof v === 'string' && v.includes(`{{${STATE_PLACEHOLDER}}}`))) {
    add('/state/env', 'required', `names {{${STATE_PLACEHOLDER}}} at least once`);
  }
}

function stateTemplate(add: Add, path: string, value: unknown) {
  if (!string(add, path, value, undefined, MAX.template)) return;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (name !== STATE_PLACEHOLDER) {
      add(path, 'unknown', `state.env knows only {{${STATE_PLACEHOLDER}}}`);
      return;
    }
  }
  string(add, path, value, PATTERNS.stateTemplate);
}
