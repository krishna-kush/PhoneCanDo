// How a kind takes a local model (`models`): one entry per wire API it can
// talk to a model server with, in the order it prefers them, each with the
// env it sets and the args that go in right after its program. The runner
// picks the first API the model server serves and fills {{baseUrl}},
// {{model}}, {{contextWindow}} and {{modelKey}}; the key goes only in env
// values, so it never shows in a process list. Nothing else of the kind's
// templates is known here: a model block names the model, never the engine.
import { fields, list, oneOf, record, string, type Add, type Json } from './primitives.ts';
import { MAX, MODEL_APIS, MODEL_PLACEHOLDERS, MODEL_SECRET_PLACEHOLDER, PATTERNS } from './rules.ts';

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export function checkModels(add: Add, value: unknown) {
  const ok = record(add, '/models', value, (path, api, wiring) => {
    if (oneOf(add, path, api, MODEL_APIS)) checkWiring(add, path, wiring);
  });
  if (ok && Object.keys(value as Json).length === 0) add('/models', 'required', 'name at least one API, or leave models out');
}

function checkWiring(add: Add, path: string, value: unknown) {
  if (!fields(add, path, value, ['env', 'args'], [])) return;
  const w = value as Json;
  if (!('env' in w) && !('args' in w)) add(path, 'required', 'set env, args or both');
  if ('env' in w) {
    record(add, `${path}/env`, w.env, (p, name, v) => {
      if (string(add, p, name, PATTERNS.envName, MAX.envName) && new RegExp(PATTERNS.envReserved, 'u').test(name)) {
        add(p, 'reserved', `${name} is the host's to set`);
      }
      modelTemplate(add, p, v, true);
    });
  }
  if ('args' in w) list(add, `${path}/args`, w.args, { min: 1, unique: false }, (p, v) => modelTemplate(add, p, v, false));
}

function modelTemplate(add: Add, path: string, value: unknown, secret: boolean) {
  if (!string(add, path, value, undefined, MAX.template)) return;
  let named = true;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!MODEL_PLACEHOLDERS.includes(name)) {
      add(path, 'unknown', `a model block knows only {{${MODEL_PLACEHOLDERS.join('}}, {{')}}}`);
      named = false;
    } else if (name === MODEL_SECRET_PLACEHOLDER && !secret) {
      add(path, 'forbidden', `{{${MODEL_SECRET_PLACEHOLDER}}} goes only in env values`);
      named = false;
    }
  }
  if (named) string(add, path, value, secret ? PATTERNS.modelEnvTemplate : PATTERNS.modelTemplate);
}
