// The manifest validator over agents/kit/schema/fixtures, and the validator
// kept in step with agent.schema.json (fields, enums, patterns).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ANY_FAMILY,
  CHANNELS,
  ENGINE_STYLES,
  EVENT_SOURCES,
  FAMILIES,
  FIELDS,
  HOMES,
  IDLE_SOURCES,
  KIND_TYPES,
  LINKAGES,
  LINUX_NEEDS,
  MAX,
  MAX_USER_MANIFEST_BYTES,
  PAIR_METHODS,
  PALETTE_ROLES,
  PATTERNS,
  PHONE_TOOLS,
  PLACEHOLDERS,
  PTY_EVENTS,
  PTY_SIGNALS,
  READINESS_RULES,
  REQUIRED,
  SIGN_IN_METHODS,
  STABILITIES,
  TOOLCHAINS,
} from './rules.ts';
import type { Origin } from './types.ts';
import { validate } from './validate.ts';

const SCHEMA_DIR = new URL('../../schema/', import.meta.url);
const OPENCODE_MANIFEST = new URL('../../../native/opencode/agent.json', import.meta.url);
const FIXTURES = new URL('fixtures/', SCHEMA_DIR);
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const schema = readJson(new URL('agent.schema.json', SCHEMA_DIR));
const expected: Record<string, { path: string; code: string }[]> = readJson(new URL('expect.json', FIXTURES)).invalid;

// Files named user-*.json are user-added kinds (expect.json says the same).
const originOf = (file: string): Origin => (file.startsWith('user-') ? 'user' : 'bundled');
const fixtures = (kind: 'valid' | 'invalid') =>
  readdirSync(new URL(`${kind}/`, FIXTURES))
    .filter((f) => f.endsWith('.json'))
    .sort();

describe('fixtures', () => {
  for (const file of fixtures('valid')) {
    it(`valid/${file} validates`, () => {
      const result = validate(readJson(new URL(`valid/${file}`, FIXTURES)), { origin: originOf(file) });
      assert.deepEqual(result.problems, []);
      assert.equal(result.ok, true);
    });
  }

  for (const file of fixtures('invalid')) {
    it(`invalid/${file} reports its problems`, () => {
      const want = expected[file];
      assert.ok(want?.length, `expect.json lists no problems for ${file}`);
      const result = validate(readJson(new URL(`invalid/${file}`, FIXTURES)), { origin: originOf(file) });
      assert.equal(result.ok, false);
      const got = result.problems.map((p) => `${p.path} ${p.code}`);
      for (const p of want) assert.ok(got.includes(`${p.path} ${p.code}`), `${p.path} ${p.code} not in [${got.join(', ')}]`);
    });
  }

  it('expect.json names only fixtures that exist', () => {
    assert.deepEqual(Object.keys(expected).sort(), fixtures('invalid'));
  });

  it('valid/opencode.json is the real opencode manifest', () => {
    assert.deepEqual(readJson(new URL('valid/opencode.json', FIXTURES)), readJson(OPENCODE_MANIFEST));
  });
});

describe('rules beyond the fixtures', () => {
  const opencode = () => readJson(new URL('valid/opencode.json', FIXTURES));

  it('caps a user-added manifest at 64 KiB', () => {
    const htop = readJson(new URL('valid/user-htop.json', FIXTURES));
    htop.install = 'x'.repeat(MAX_USER_MANIFEST_BYTES);
    const result = validate(htop, { origin: 'user' });
    assert.ok(result.problems.some((p) => p.path === '' && p.code === 'too-large'));
  });

  it('escapes unknown keys as JSON pointers', () => {
    const result = validate({ ...opencode(), 'a/b~c': 1 }, { origin: 'bundled' });
    assert.ok(result.problems.some((p) => p.path === '/a~1b~0c' && p.code === 'unknown'));
  });

  it('checks models in full (models.test.ts has the rules)', () => {
    const wrong = validate({ ...opencode(), models: [] }, { origin: 'bundled' });
    assert.ok(wrong.problems.some((p) => p.path === '/models' && p.code === 'type'));
    const extra = validate({ ...opencode(), models: { anthropic: { env: {}, anything: [1] } } }, { origin: 'bundled' });
    assert.ok(extra.problems.some((p) => p.path === '/models/anthropic/anything'));
  });

  it('reports a missing field once, as required', () => {
    const { licence: _, ...rest } = opencode();
    assert.deepEqual(validate(rest, { origin: 'bundled' }).problems, [
      { path: '/licence', code: 'required', detail: 'licence is required' },
    ]);
  });
});

describe('validator and schema agree', () => {
  const props = schema.properties;
  const defs = schema.$defs;

  it('has the same top-level fields and required list', () => {
    assert.deepEqual(Object.keys(props).sort(), [...FIELDS].sort());
    assert.deepEqual([...schema.required].sort(), [...REQUIRED].sort());
  });

  it('has the same enums', () => {
    assert.deepEqual(props.channels.items.enum, CHANNELS);
    assert.deepEqual(props.type.enum, KIND_TYPES);
    assert.deepEqual(props.stability.enum, STABILITIES);
    assert.deepEqual(props.build.properties.toolchains.items.enum, TOOLCHAINS);
    assert.deepEqual(defs.lib.properties.linkage.enum, LINKAGES);
    assert.deepEqual(props.phoneTools.enum, PHONE_TOOLS);
    assert.deepEqual(props.engine.properties.style.enum, ENGINE_STYLES);
    assert.deepEqual(props.surfaces.properties.home.enum, HOMES);
    assert.deepEqual(defs.webPair.properties.method.enum, PAIR_METHODS);
    assert.deepEqual(props.idle.properties.from.items.enum, IDLE_SOURCES);
    assert.deepEqual(props.signIn.items.properties.method.enum, SIGN_IN_METHODS);
    assert.deepEqual(defs.webAdapter.properties.cssVars.additionalProperties.enum, PALETTE_ROLES);
    assert.deepEqual(defs.argv.items.oneOf[1].properties.when.enum, PLACEHOLDERS);
    assert.deepEqual(props.requires.properties.linux.enum, LINUX_NEEDS);
    assert.deepEqual(defs.ptyRule.properties.on.enum, PTY_SIGNALS);
    assert.deepEqual(defs.ptyRule.properties.event.enum, PTY_EVENTS);
    assert.deepEqual(Object.keys(props.engine.properties.readiness.properties), READINESS_RULES);
    assert.deepEqual(Object.keys(props.events.items.properties).sort(), [...EVENT_SOURCES].sort());
    assert.deepEqual(props.events.items.properties.hook.properties.map.additionalProperties.enum, PTY_EVENTS);
    assert.deepEqual(defs.family.enum, FAMILIES);
    assert.deepEqual(props.install.properties.packages.propertyNames.enum, [...FAMILIES, ANY_FAMILY]);
  });

  it('has the same patterns', () => {
    assert.equal(props.id.pattern, PATTERNS.id);
    assert.equal(props.prefix.pattern, PATTERNS.prefix);
    assert.equal(props.licence.properties.spdx.pattern, PATTERNS.spdx);
    assert.equal(defs.name.pattern, PATTERNS.name);
    assert.equal(defs.url.pattern, PATTERNS.url);
    assert.equal(defs.relPath.pattern, PATTERNS.relPath);
    assert.equal(defs.lib.properties.name.pattern, PATTERNS.libName);
    assert.equal(defs.lib.properties.from.pattern, PATTERNS.libFrom);
    assert.equal(defs.template.pattern, PATTERNS.template);
    assert.equal(defs.envTemplate.pattern, PATTERNS.envTemplate);
    assert.equal(defs.httpPath.allOf[1].pattern, PATTERNS.httpPath);
    assert.equal(defs.jsonPointer.pattern, PATTERNS.jsonPointer);
    assert.equal(defs.env.propertyNames.pattern, PATTERNS.envName);
    assert.equal(defs.env.propertyNames.not.pattern, PATTERNS.envReserved);
    assert.equal(defs.hookId.pattern, PATTERNS.hookId);
    assert.equal(props.engine.properties.auth.properties.basic.properties.user.pattern, PATTERNS.basicUser);
    assert.equal(defs.webAdapter.properties.cssVars.propertyNames.pattern, PATTERNS.cssVar);
    assert.equal(defs.webAdapter.properties.colorSchemeKey.pattern, PATTERNS.storageKey);
    assert.equal(defs.webAdapter.properties.hide.items.pattern, PATTERNS.selector);
    assert.equal(defs.webAdapter.properties.authUrl.pattern, PATTERNS.httpPath);
    assert.equal(defs.guestProgram.pattern, PATTERNS.guestProgram);
    assert.equal(props.requires.properties.commands.items.pattern, PATTERNS.command);
    assert.equal(props.requires.properties.runtimes.items.pattern, PATTERNS.runtimeNeed);
    assert.equal(props.install.properties.packages.additionalProperties.items.pattern, PATTERNS.package);
    assert.equal(props.events.items.properties.hook.properties.map.propertyNames.pattern, PATTERNS.eventName);
    assert.equal(defs.guestTemplate.pattern, PATTERNS.guestTemplate);
    assert.equal(defs.stateTemplate.pattern, PATTERNS.stateTemplate);
    assert.equal(props.state.properties.env.propertyNames.pattern, PATTERNS.envName);
    assert.equal(props.state.properties.env.propertyNames.not.pattern, PATTERNS.envReserved);
    assert.equal(defs.versionCheck.properties.argv.prefixItems[0].allOf[1].pattern, PATTERNS.guestTool);
  });

  it('has the same install rules', () => {
    assert.deepEqual(schema.dependentRequired, { install: ['versionCheck'], update: ['install'], versionCheck: ['install'] });
    assert.equal(props.install.properties.timeoutSec.maximum, MAX.installSec);
    assert.equal(props.install.properties.retries.minimum, 0);
    assert.equal(props.install.properties.retries.maximum, MAX.installRetries);
    assert.equal(props.install.properties.packages.additionalProperties.items.maxLength, MAX.package);
  });
});
