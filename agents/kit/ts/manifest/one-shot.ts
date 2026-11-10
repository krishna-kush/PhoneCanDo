// A kind's one-shot mode (one-shot.json beside its agent.json): the argv
// that answers one prompt and exits, and env on top of the kind's launch
// env. CI's local-model check runs it against our model server with the
// kind's `models` wiring (kit-cli render-model,
// .github/workflows/local-models.yml), so a kind with a `models` block needs
// one (agents/kit/cli/manifests.mjs). Only CI reads it; nothing packages it.
//
//   argv  the program first, as the kind's own launch names one (an image
//         kind: a guest command or an absolute guest path; a native kind:
//         {{libDir}}/<one of its payload libs>), then its args; exactly one
//         item is {{prompt}}, the caller's text, put in as it is.
//   env   like a launch's env, without {{password}} (a one-shot has no
//         engine password).
// Placeholders: {{home}}, {{tmp}}, {{projectDir}}; {{libDir}} in a native
// kind's; {{prompt}} as a whole argv item only.
import { fields, list, record, string, type Add, type Json } from './primitives.ts';
import { MAX, PATTERNS } from './rules.ts';
import type { Manifest, Problem, ValidationResult } from './types.ts';

export const ONE_SHOT_FILE = 'one-shot.json';
export const PROMPT = '{{prompt}}';
const PLACEHOLDERS = ['home', 'tmp', 'projectDir'];
const NATIVE_PLACEHOLDERS = [...PLACEHOLDERS, 'libDir'];
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

/** one-shot.json for `kind`, a manifest that passed validate(). */
export function validateOneShot(json: unknown, kind: Manifest): ValidationResult {
  const problems: Problem[] = [];
  const add: Add = (path, code, detail) => problems.push({ path, code, detail });
  if (!fields(add, '', json, ['argv', 'env'], ['argv'])) return { ok: false, problems };
  const o = json as Json;
  const known = kind.type === 'native' ? NATIVE_PLACEHOLDERS : PLACEHOLDERS;
  const listed = list(add, '/argv', o.argv, { min: 2, unique: false }, (path, item) => {
    if (item !== PROMPT) placeholders(add, path, item, known);
  });
  if (listed) {
    const argv = o.argv as unknown[];
    const at = argv.flatMap((item, i) => (item === PROMPT ? [i] : []));
    if (at.length !== 1 || at[0] === 0) add('/argv', 'pattern', `holds ${PROMPT} as exactly one item, after the program`);
    program(add, argv[0], kind);
  }
  record(add, '/env', o.env, (path, name, value) => {
    if (string(add, path, name, PATTERNS.envName, MAX.envName) && new RegExp(PATTERNS.envReserved, 'u').test(name)) {
      add(path, 'reserved', `${name} is the host's to set`);
    }
    placeholders(add, path, value, known);
  });
  return { ok: problems.length === 0, problems };
}

// The program, as the kind's launch names one.
function program(add: Add, value: unknown, kind: Manifest) {
  if (typeof value !== 'string' || value === PROMPT) return;
  if (kind.type === 'image') {
    if (!new RegExp(PATTERNS.guestProgram, 'u').test(value)) {
      add('/argv/0', 'pattern', 'an image kind runs a guest command or an absolute guest path');
    }
    return;
  }
  const libs = (kind.payload?.libs ?? []).map((lib) => `{{libDir}}/${lib.name}`);
  if (!libs.includes(value)) add('/argv/0', 'pattern', `a native kind runs one of its libs: ${libs.join(', ')}`);
}

function placeholders(add: Add, path: string, value: unknown, known: string[]) {
  if (!string(add, path, value, undefined, MAX.template)) return;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!known.includes(name)) {
      const where = name === 'prompt' ? `; ${PROMPT} is a whole argv item` : '';
      add(path, 'unknown', `{{${name}}} has no value in a one-shot (known: {{${known.join('}}, {{')}}})${where}`);
    }
  }
}
