// A kind's probes (probes.json beside its agent.json): what CI's weekly
// check of the newest releases (.github/workflows/agents-latest.yml) asks
// of the kind once it is installed, with no sign-in, model or secret, to
// see that the agent still takes what we rely on. Only CI reads it; nothing
// packages it. An image kind's only: a native kind runs the payload we
// built, which agent-payload.yml checks.
//
//   help  each {argv, has, env?}: the combined output (stdout and stderr)
//         holds every `has` string; the exit code does not count. For the
//         flags and subcommands our launch, resume, prompt, chat and ACP
//         args use.
//   run   each {argv, env?, has?}: exits 0, and the combined output holds
//         every `has` string. For proving the agent still reads our config
//         or keys (a config check, an MCP list).
//   acp   {require}: the kind's engine.acp started as the runner starts it
//         and sent the runner's initialize; each dotted path in `require`
//         (`agentCapabilities.loadSession`) is truthy in the answer. Only a
//         kind with engine.acp.
//
// Each probe runs as the kind's launch runs (its cwd, its launch env and
// the runner's, its runtimes first on PATH), `env` on top. argv[0] is a
// guest command or an absolute guest path, as a launch's; the other items
// and env values may name {{home}}, {{projectDir}} and, for a kind with a
// config folder, {{config}} (where the runner seeds it). `has` strings are
// plain text, never rendered.
import { fields, list, record, string, type Add, type Json } from './primitives.ts';
import { MAX, PATTERNS } from './rules.ts';
import type { Manifest, Problem, ValidationResult } from './types.ts';

export const PROBES_FILE = 'probes.json';
export const PROBE_PLACEHOLDERS = ['home', 'projectDir', 'config'];
/** The most probes in `help` or `run`, and paths in `acp.require`. */
export const MAX_PROBES = 16;
/** A dotted path into the initialize answer: JSON keys joined by dots. */
export const ACP_PATH = '^[A-Za-z_$][A-Za-z0-9_$-]*(?:\\.[A-Za-z_$][A-Za-z0-9_$-]*)*$';
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

/** probes.json for `kind`, a manifest that passed validate(). */
export function validateProbes(json: unknown, kind: Manifest): ValidationResult {
  const problems: Problem[] = [];
  const add: Add = (path, code, detail) => problems.push({ path, code, detail });
  if (!fields(add, '', json, ['help', 'run', 'acp'], [])) return { ok: false, problems };
  const o = json as Json;
  if (kind.type !== 'image') add('', 'forbidden', 'probes are for image kinds, which CI installs at their newest release');
  if (!('help' in o || 'run' in o || 'acp' in o)) add('', 'required', 'needs help, run or acp');
  const known = kind.config?.dir ? PROBE_PLACEHOLDERS : PROBE_PLACEHOLDERS.filter((n) => n !== 'config');
  probes(add, '/help', o.help, known, true);
  probes(add, '/run', o.run, known, false);
  if (o.acp !== undefined) acp(add, o.acp, kind);
  return { ok: problems.length === 0, problems };
}

function probes(add: Add, path: string, value: unknown, known: string[], help: boolean) {
  list(add, path, value, { min: 1, unique: true }, (at, probe) => {
    if (!fields(add, at, probe, ['argv', 'env', 'has'], help ? ['argv', 'has'] : ['argv'])) return;
    const p = probe as Json;
    list(add, `${at}/argv`, p.argv, { min: 1, unique: false }, (item, arg) => {
      if (item === `${at}/argv/0`) string(add, item, arg, PATTERNS.guestProgram, MAX.template);
      else placeholders(add, item, arg, known);
    });
    record(add, `${at}/env`, p.env, (item, name, v) => {
      if (string(add, item, name, PATTERNS.envName, MAX.envName) && new RegExp(PATTERNS.envReserved, 'u').test(name)) {
        add(item, 'reserved', `${name} is the host's to set`);
      }
      placeholders(add, item, v, known);
    });
    const has = list(add, `${at}/has`, p.has, { min: help ? 1 : 0, unique: true }, (item, s) => {
      if (typeof s === 'string' && s.length === 0) add(item, 'length', 'must not be empty');
      else string(add, item, s, undefined, MAX.note);
    });
    if (has && (p.has as unknown[]).length > MAX_PROBES) add(`${at}/has`, 'length', `at most ${MAX_PROBES} items`);
  });
  if (Array.isArray(value) && value.length > MAX_PROBES) add(path, 'length', `at most ${MAX_PROBES} probes`);
}

function acp(add: Add, value: unknown, kind: Manifest) {
  if (!fields(add, '/acp', value, ['require'], ['require'])) return;
  if (!kind.engine?.acp) add('/acp', 'forbidden', 'the kind has no ACP mode (engine.acp)');
  const require = (value as Json).require;
  list(add, '/acp/require', require, { min: 1, unique: true }, (at, path) => string(add, at, path, ACP_PATH, MAX.note));
  if (Array.isArray(require) && require.length > MAX_PROBES) add('/acp/require', 'length', `at most ${MAX_PROBES} paths`);
}

function placeholders(add: Add, path: string, value: unknown, known: string[]) {
  if (!string(add, path, value, undefined, MAX.template)) return;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!known.includes(name)) add(path, 'unknown', `{{${name}}} has no value in a probe (known: {{${known.join('}}, {{')}}})`);
  }
}
