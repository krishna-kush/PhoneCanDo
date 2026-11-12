// Validates one agent kind manifest (agent.json, schema 1): every rule of
// agents/kit/schema/agent.schema.json, plus the ones JSON Schema cannot say
// (lib names, reserved ids and prefixes, template placeholders, what a
// user-added kind may hold). Pure and dependency-free: the kit's CLI runs it
// on Node, the app on Hermes. Folder rules (folder name = id, prefixes unique
// across kinds, files that must exist) need the tree and live in
// agents/kit/cli/manifests.mjs. The runtime blocks are in runtime.ts, the
// install blocks in install.ts, the instructions file and the agent's own
// state folder in state.ts, the rules per type and origin in kinds.ts. A
// runtime plugin's manifest has its own validator (runtime-plugin.ts).
import {
  fields,
  isObject,
  list,
  oneOf,
  relPath,
  string,
  text,
  uniqueBy,
  utf8Length,
  type Add,
  type Json,
} from './primitives.ts';
import { checkInstall } from './install.ts';
import { checkRequires, checkType, checkUser } from './kinds.ts';
import {
  CHANNELS,
  CONFIG_NEEDS_DIR,
  FIELDS,
  KIND_TYPES,
  LINKAGES,
  MAX,
  MAX_USER_MANIFEST_BYTES,
  PATTERNS,
  REQUIRED,
  RESERVED_IDS,
  RESERVED_PREFIXES,
  SCHEMA_VERSION,
  STABILITIES,
  TOOLCHAINS,
  USER_ID_PREFIX,
  USER_OPTIONAL,
} from './rules.ts';
import { checkModels } from './models.ts';
import { checkRuntime } from './runtime.ts';
import { checkState } from './state.ts';
import type { Problem, ValidateOptions, ValidationResult } from './types.ts';

const LICENCE_FIELDS = ['spdx', 'redistributed', 'notice', 'terms', 'source'];
const LIB_FIELDS = ['name', 'from', 'role', 'linkage'];
const CONFIG_FIELDS = ['dir', 'overlay', 'fullOnly', 'shared', 'into', 'keep', 'required', 'files'];

export function validate(json: unknown, options: ValidateOptions): ValidationResult {
  const problems: Problem[] = [];
  const add: Add = (path, code, detail) => {
    if (!problems.some((p) => p.path === path && p.code === code)) problems.push({ path, code, detail });
  };
  if (!isObject(json)) {
    add('', 'type', 'a manifest is a JSON object');
    return { ok: false, problems };
  }
  const user = options.origin === 'user';
  // Measured re-serialised (compact), so a pretty-printed file may be larger.
  if (user && utf8Length(JSON.stringify(json)) > MAX_USER_MANIFEST_BYTES) {
    add('', 'too-large', `a user-added manifest is at most ${MAX_USER_MANIFEST_BYTES} bytes`);
  }

  fields(add, '', json, FIELDS, user ? REQUIRED.filter((key) => !USER_OPTIONAL.includes(key)) : REQUIRED);
  if ('schema' in json && json.schema !== SCHEMA_VERSION) {
    add('/schema', 'const', `schema must be ${SCHEMA_VERSION}`);
  }
  checkId(add, json.id, user);
  text(add, '/label', json.label);
  text(add, '/version', json.version);
  oneOf(add, '/type', json.type, KIND_TYPES);
  if ('prefix' in json) checkPrefix(add, json.prefix);
  list(add, '/channels', json.channels, { min: 1, unique: true }, (p, v) => oneOf(add, p, v, CHANNELS));
  oneOf(add, '/stability', json.stability, STABILITIES);
  if ('default' in json && typeof json.default !== 'boolean') add('/default', 'type', 'must be true or false');
  if ('licence' in json) checkLicence(add, json.licence);
  if ('payload' in json) checkPayload(add, json.payload, json.prefix);
  if ('build' in json) checkBuild(add, json.build);
  if ('config' in json) checkConfig(add, json.config);
  if ('requires' in json) checkRequires(add, json.requires);
  checkInstall(add, json);
  checkRuntime(add, json);
  if ('models' in json) checkModels(add, json.models);
  checkState(add, json);

  checkType(add, json);
  if (user) checkUser(add, json);
  return { ok: problems.length === 0, problems };
}

// --- identity ---------------------------------------------------------------

function checkId(add: Add, id: unknown, user: boolean) {
  if (!string(add, '/id', id, PATTERNS.id, MAX.id)) return;
  const name = id as string;
  if (user && !name.startsWith(USER_ID_PREFIX)) {
    add('/id', 'pattern', `a user-added kind's id is ${USER_ID_PREFIX}<name>`);
  }
  if (!user && name.startsWith(USER_ID_PREFIX)) {
    add('/id', 'reserved', `${USER_ID_PREFIX}* ids are for user-added kinds`);
  }
  if (RESERVED_IDS.includes(name)) add('/id', 'reserved', `${name} is reserved (${RESERVED_IDS.join(', ')})`);
}

function checkPrefix(add: Add, prefix: unknown) {
  if (!string(add, '/prefix', prefix, PATTERNS.prefix, MAX.prefix)) return;
  if (RESERVED_PREFIXES.includes(prefix as string)) {
    add('/prefix', 'reserved', `${prefix} is reserved (${RESERVED_PREFIXES.join(', ')})`);
  }
}

// The SPDX id may be null (unknown) only for a kind we do not redistribute.
function checkLicence(add: Add, licence: unknown) {
  if (!fields(add, '/licence', licence, LICENCE_FIELDS, ['spdx', 'redistributed', 'source'])) return;
  const l = licence as Json;
  if (l.spdx !== null) string(add, '/licence/spdx', l.spdx, PATTERNS.spdx, MAX.text);
  else if (l.redistributed !== false) add('/licence/spdx', 'type', 'a kind we redistribute names its SPDX licence');
  if ('redistributed' in l && typeof l.redistributed !== 'boolean') {
    add('/licence/redistributed', 'type', 'must be true or false');
  }
  if ('notice' in l) relPath(add, '/licence/notice', l.notice);
  if ('terms' in l) string(add, '/licence/terms', l.terms, PATTERNS.url, MAX.url);
  string(add, '/licence/source', l.source, PATTERNS.url, MAX.url);
}

// --- native payload and build -----------------------------------------------

function checkPayload(add: Add, payload: unknown, prefix: unknown) {
  if (!fields(add, '/payload', payload, ['libs'], ['libs'])) return;
  const libs = (payload as Json).libs;
  const ok = list(add, '/payload/libs', libs, { min: 1, unique: false }, (p, lib) => checkLib(add, p, lib, prefix));
  if (!ok) return;
  const entries = (libs as unknown[]).filter(isObject);
  uniqueBy(add, '/payload/libs', entries, 'name');
  uniqueBy(add, '/payload/libs', entries, 'role');
  if (!entries.some((lib) => lib.role === 'engine')) {
    add('/payload/libs', 'required', 'one lib has role engine (lib<prefix>-engine.so)');
  }
}

function checkLib(add: Add, path: string, lib: unknown, prefix: unknown) {
  if (!fields(add, path, lib, LIB_FIELDS, LIB_FIELDS)) return;
  const l = lib as Json;
  const named = string(add, `${path}/name`, l.name, PATTERNS.libName);
  string(add, `${path}/from`, l.from, PATTERNS.libFrom, MAX.libFrom);
  const roled = string(add, `${path}/role`, l.role, PATTERNS.name, MAX.name);
  oneOf(add, `${path}/linkage`, l.linkage, LINKAGES);
  if (named && roled && typeof prefix === 'string' && l.name !== `lib${prefix}-${l.role}.so`) {
    add(`${path}/name`, 'mismatch', `must be lib${prefix}-${l.role}.so (lib<prefix>-<role>.so)`);
  }
}

function checkBuild(add: Add, build: unknown) {
  if (!fields(add, '/build', build, ['toolchains'], ['toolchains'])) return;
  list(add, '/build/toolchains', (build as Json).toolchains, { min: 1, unique: true }, (p, v) =>
    oneOf(add, p, v, TOOLCHAINS),
  );
}

// --- bundled config asset ---------------------------------------------------

function checkConfig(add: Add, config: unknown) {
  if (!fields(add, '/config', config, CONFIG_FIELDS, ['into'])) return;
  const c = config as Json;
  for (const key of ['dir', 'overlay', 'into']) {
    if (key in c) relPath(add, `/config/${key}`, c[key]);
  }
  for (const key of ['fullOnly', 'keep', 'required']) {
    if (key in c) list(add, `/config/${key}`, c[key], { min: 0, unique: true }, (p, v) => relPath(add, p, v));
  }
  if ('shared' in c) {
    list(add, '/config/shared', c.shared, { min: 0, unique: true }, (p, v) =>
      string(add, p, v, PATTERNS.name, MAX.name),
    );
  }
  if ('files' in c && !Array.isArray(c.files)) add('/config/files', 'type', 'must be an array');
  for (const key of CONFIG_NEEDS_DIR) {
    if (key in c && !('dir' in c)) add('/config/dir', 'required', `config.${key} needs config.dir`);
  }
}


