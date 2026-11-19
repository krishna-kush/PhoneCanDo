// The manifest validator over agents/kit/schema/fixtures, and the validator
// kept in step with agent.schema.json (fields, enums, patterns).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ABOUT_KEYS,
  ABOUT_LINKS,
  ACP_FIELDS,
  ACP_TOOLS,
  ANY_FAMILY,
  CHANNELS,
  CHAT_PLACEHOLDER,
  ENGINE_STYLES,
  EVENT_SOURCES,
  FAMILIES,
  FIELDS,
  FREE_VIA,
  HOMES,
  IDLE_SOURCES,
  INBOX_FORMATS,
  INBOX_KEYS,
  INBOX_METHODS,
  INBOX_WAKES,
  KIND_TYPES,
  LINKAGES,
  LINUX_NEEDS,
  MAX,
  MAX_USER_MANIFEST_BYTES,
  MCP_PHONE_TOOLS,
  PAIR_METHODS,
  PALETTE_ROLES,
  PATTERNS,
  PHONE_TOOLS,
  PLACEHOLDERS,
  PROMPT_PLACEHOLDER,
  PTY_EVENTS,
  PTY_SIGNALS,
  READINESS_RULES,
  REQUIRED,
  SIGN_IN_METHODS,
  STABILITIES,
  TOOLCHAINS,
  TRUST_IN_ARGV,
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

  it("reads a chat's reply only through a hook it lists", () => {
    const m = opencode();
    const unhooked = validate({ ...m, hooks: ['opencode.events'] }, { origin: 'bundled' });
    assert.ok(unhooked.problems.some((p) => p.path === '/chats/reply/http/parser' && p.code === 'mismatch'));
    const noParser = validate({ ...m, chats: { ...m.chats, reply: { http: { path: '/m' } } } }, { origin: 'bundled' });
    assert.ok(noParser.problems.some((p) => p.path === '/chats/reply/http/parser' && p.code === 'required'));
  });

  it("builds a chat's web path from its id and the page's origin only", () => {
    const m = opencode();
    const withPath = (sessionPath: string, sessionUrl: string | null = m.surfaces.web.adapter.sessionUrl) => {
      const { sessionUrl: _, ...rest } = m.surfaces.web.adapter;
      const adapter = { ...rest, sessionPath, ...(sessionUrl ? { sessionUrl } : {}) };
      return validate({ ...m, surfaces: { ...m.surfaces, web: { ...m.surfaces.web, adapter } } }, { origin: 'bundled' }).problems;
    };
    const at = '/surfaces/web/adapter/sessionPath';
    assert.deepEqual(withPath('/server/{{origin64}}/session/{{sessionId}}'), []);
    assert.ok(withPath('/server/{{port}}/session/{{sessionId}}').some((p) => p.path === at && p.code === 'unknown'));
    assert.ok(withPath('/server/{{origin64}}').some((p) => p.path === at && p.code === 'required'));
    assert.ok(withPath('/s/{{sessionId}}', null).some((p) => p.path === at && p.code === 'required'));
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
    assert.deepEqual(Object.keys(props.inbox.properties), INBOX_KEYS);
    assert.deepEqual(props.inbox.properties.wake.enum, INBOX_WAKES);
    assert.deepEqual(defs.inboxHook.properties.format.enum, INBOX_FORMATS);
    assert.deepEqual(defs.inboxCall.properties.method.enum, INBOX_METHODS);
    assert.deepEqual(props.inbox.properties.server.properties.create.properties.method.enum, INBOX_METHODS);
    assert.deepEqual(Object.keys(props.engine.properties.acp.properties), ACP_FIELDS);
    assert.deepEqual(props.engine.properties.acp.properties.tools.enum, ACP_TOOLS);
    assert.deepEqual(Object.keys(props.about.properties), ABOUT_KEYS);
    assert.deepEqual(Object.keys(props.about.properties.links.properties), ABOUT_LINKS);
    assert.deepEqual(props.about.properties.free.properties.via.enum, FREE_VIA);
  });

  it('has the same patterns', () => {
    assert.equal(props.id.pattern, PATTERNS.id);
    assert.equal(props.prefix.pattern, PATTERNS.prefix);
    assert.equal(props.licence.properties.spdx.pattern, PATTERNS.spdx);
    assert.equal(props.about.properties.checked.pattern, PATTERNS.day);
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
    assert.equal(props.inbox.properties.hooks.propertyNames.pattern, PATTERNS.eventName);
    assert.equal(defs.inboxHookText.pattern, PATTERNS.inboxHookTemplate);
    assert.equal(defs.inboxCall.properties.path.allOf[0].pattern, PATTERNS.httpPath);
    assert.equal(defs.inboxCall.properties.path.allOf[1].pattern, PATTERNS.inboxPathTemplate);
    assert.equal(defs.inboxBodyText.pattern, PATTERNS.inboxBodyTemplate);
    assert.equal(defs.inboxCreateText.pattern, PATTERNS.inboxCreateTemplate);
    assert.equal(props.inbox.properties.server.properties.create.properties.path.pattern, PATTERNS.httpPath);
    assert.equal(defs.promptTemplate.pattern, PATTERNS.promptTemplate);
    assert.equal(props.engine.properties.prompt.properties.args.contains.const, `{{${PROMPT_PLACEHOLDER}}}`);
    assert.equal(defs.chatTemplate.pattern, PATTERNS.chatTemplate);
    assert.equal(props.engine.properties.acp.properties.chat.properties.args.contains.const, `{{${CHAT_PLACEHOLDER}}}`);
  });

  it('has the same prompt and resume limits', () => {
    assert.equal(props.engine.properties.resume.properties.at.maximum, MAX.resumeAt);
    assert.equal(props.engine.properties.prompt.properties.at.maximum, MAX.resumeAt);
    assert.equal(defs.promptTemplate.maxLength, MAX.template);
  });

  it('has the same ACP limits', () => {
    const acp = props.engine.properties.acp.properties;
    assert.equal(acp.options.maxProperties, MAX.acpOptions);
    assert.equal(acp.options.propertyNames.maxLength, MAX.text);
    assert.equal(acp.options.additionalProperties.maxLength, MAX.text);
    assert.equal(acp.chat.properties.at.maximum, MAX.resumeAt);
    assert.equal(defs.chatTemplate.maxLength, MAX.template);
  });

  it('has the same inbox limits', () => {
    assert.equal(defs.inboxHook.properties.exit.maximum, MAX.hookExit);
    assert.equal(props.inbox.properties.hooks.propertyNames.maxLength, MAX.name);
    for (const def of [defs.inboxHookText, defs.inboxBodyText, defs.inboxCreateText, defs.inboxCall.properties.path]) {
      assert.equal(def.maxLength, MAX.template);
    }
  });

  it('has the same phone tools trust', () => {
    const trust = props.phoneToolsTrust;
    assert.equal(trust.properties.has.maxLength, MAX.trustHas);
    assert.equal(trust.properties.in.$ref, '#/$defs/relPath');
    const rule = schema.allOf.find((r: { if?: { required?: string[] } }) => r.if?.required?.[0] === 'phoneToolsTrust');
    assert.deepEqual(rule.then.properties.phoneTools.enum, MCP_PHONE_TOOLS);
    assert.equal(rule.then.if.properties.phoneToolsTrust.properties.in.not.const, TRUST_IN_ARGV);
  });

  it('has the same about limits', () => {
    assert.equal(props.about.properties.free.properties.note.maxLength, MAX.freeNote);
    assert.equal(props.about.properties.move.properties.keys.maxLength, MAX.moveKeys);
    assert.equal(props.about.properties.move.properties.does.maxLength, MAX.moveDoes);
  });

  it('has the same install rules', () => {
    assert.deepEqual(schema.dependentRequired, { install: ['versionCheck'], update: ['install'], versionCheck: ['install'] });
    assert.equal(props.install.properties.timeoutSec.maximum, MAX.installSec);
    assert.equal(props.install.properties.retries.minimum, 0);
    assert.equal(props.install.properties.retries.maximum, MAX.installRetries);
    assert.equal(props.install.properties.packages.additionalProperties.items.maxLength, MAX.package);
  });
});
