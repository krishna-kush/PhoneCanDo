// The runtime plugin validator over agents/kit/schema/fixtures/runtime, the
// validator kept in step with runtime.schema.json, and the check patterns
// the guest's grep -E can run.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ANY_FAMILY, FAMILIES, MAX, PATTERNS } from './rules.ts';
import { ereProblem, PLUGIN_FIELDS, PLUGIN_REQUIRED, validateRuntime } from './runtime-plugin.ts';

const SCHEMA_DIR = new URL('../../schema/', import.meta.url);
const FIXTURES = new URL('fixtures/runtime/', SCHEMA_DIR);
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const schema = readJson(new URL('runtime.schema.json', SCHEMA_DIR));
const expected: Record<string, { path: string; code: string }[]> = readJson(new URL('expect.json', FIXTURES)).invalid;
const fixtures = (kind: 'valid' | 'invalid') =>
  readdirSync(new URL(`${kind}/`, FIXTURES))
    .filter((f) => f.endsWith('.json'))
    .sort();

describe('runtime fixtures', () => {
  for (const file of fixtures('valid')) {
    it(`valid/${file} validates`, () => {
      assert.deepEqual(validateRuntime(readJson(new URL(`valid/${file}`, FIXTURES))).problems, []);
    });
  }

  for (const file of fixtures('invalid')) {
    it(`invalid/${file} reports its problems`, () => {
      const want = expected[file];
      assert.ok(want?.length, `expect.json lists no problems for ${file}`);
      const result = validateRuntime(readJson(new URL(`invalid/${file}`, FIXTURES)));
      assert.equal(result.ok, false);
      const got = result.problems.map((p) => `${p.path} ${p.code}`);
      for (const p of want) assert.ok(got.includes(`${p.path} ${p.code}`), `${p.path} ${p.code} not in [${got.join(', ')}]`);
    });
  }

  it('expect.json names only fixtures that exist', () => {
    assert.deepEqual(Object.keys(expected).sort(), fixtures('invalid'));
  });

  it('refuses what is not an object', () => {
    assert.deepEqual(validateRuntime([]).problems.map((p) => `${p.path} ${p.code}`), [' type']);
  });
});

describe('runtime validator and schema agree', () => {
  const props = schema.properties;

  it('has the same fields, enums and patterns', () => {
    assert.deepEqual(Object.keys(props).sort(), [...PLUGIN_FIELDS].sort());
    assert.deepEqual([...schema.required].sort(), [...PLUGIN_REQUIRED].sort());
    assert.deepEqual(props.families.items.enum, FAMILIES);
    assert.deepEqual(props.install.propertyNames.enum, [...FAMILIES, ANY_FAMILY]);
    assert.equal(props.id.pattern, PATTERNS.name);
    assert.equal(props.install.additionalProperties.pattern, PATTERNS.relPath);
    assert.equal(props.paths.items.pattern, PATTERNS.guestPath);
    assert.equal(props.check.properties.argv.prefixItems[0].pattern, PATTERNS.guestTool);
    assert.equal(props.check.properties.argv.items.pattern, PATTERNS.guestTemplate);
    assert.equal(props.licence.properties.spdx.pattern, PATTERNS.spdx);
    assert.equal(props.licence.properties.source.pattern, PATTERNS.url);
    assert.equal(props.provides.maximum, MAX.major);
  });
});

describe('ereProblem', () => {
  it('passes what translates into a POSIX ERE', () => {
    for (const ok of ['^v(\\d+)\\.', 'Python (\\d+)', '([0-9]+)', '[\\d.]+ (\\w+)', '[^]a](x)', 'a{2,3}(b)|c', 'go(\\d)\\-x\\/y']) {
      assert.equal(ereProblem(ok), null, ok);
    }
  });

  it('names what does not', () => {
    for (const bad of ['(?:v)(\\d+)', '(\\d+?)', '(\\d++)', '\\b(\\d+)', '(\\d)\\1', '[\\-a]', '[[:digit:]]', '[abc', 'x\\']) {
      assert.notEqual(ereProblem(bad), null, bad);
    }
  });
});
