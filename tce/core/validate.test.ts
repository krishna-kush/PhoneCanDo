import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reader, isPlainObject, truncate, truncateTail, utf8Length } from './validate.ts';
import { sanitizeCounters, sanitizeProps } from './wire-read.ts';

describe('truncate', () => {
  it('keeps short strings as they are', () => {
    assert.equal(truncate('abc', 3), 'abc');
    assert.equal(truncate('', 0), '');
  });

  it('cuts by code point without splitting surrogate pairs', () => {
    assert.equal(truncate('abcdef', 3), 'abc');
    assert.equal(truncate('\u{1F600}\u{1F600}\u{1F600}', 2), '\u{1F600}\u{1F600}');
    assert.equal(truncate('a\u{1F600}b', 2), 'a\u{1F600}');
  });

  it('keeps the end for tails', () => {
    assert.equal(truncateTail('abcdef', 3), 'def');
    assert.equal(truncateTail('\u{1F600}x\u{1F600}', 2), 'x\u{1F600}');
    assert.equal(truncateTail('ab', 5), 'ab');
  });

  it('measures UTF-8 bytes', () => {
    assert.equal(utf8Length('aé\u{1F600}'), 1 + 2 + 4);
  });
});

describe('Reader', () => {
  it('keeps only the first failure and returns fallbacks after it', () => {
    const r = new Reader();
    assert.equal(r.int('x', 'a', 0, 10), 0);
    assert.equal(r.string(5, 'b', 3), '');
    assert.deepEqual(r.done(1), { ok: false, error: { code: 'bad_request', message: 'must be an integer from 0 to 10', field: 'a' } });
  });

  it('treats null and absent optionals alike', () => {
    const r = new Reader();
    assert.equal(r.optionalString(undefined, 'a', 3), null);
    assert.equal(r.optionalString(null, 'a', 3), null);
    assert.equal(r.optionalInt(null, 'b', 0, 1), null);
    assert.equal(r.optionalBool(undefined, 'c'), null);
    assert.equal(r.optionalObject(null, 'd'), null);
    assert.deepEqual(r.done('ok'), { ok: true, value: 'ok' });
  });

  it('reports list caps as too_large', () => {
    const r = new Reader();
    assert.deepEqual(r.list([1, 2, 3], 'xs', 2), []);
    assert.deepEqual(r.error, { code: 'too_large', message: 'at most 2 items', field: 'xs' });
  });

  it('accepts only plausible epoch milliseconds', () => {
    const r = new Reader();
    assert.equal(r.epochMs(1_793_491_200_000, 't'), 1_793_491_200_000);
    assert.deepEqual(r.done(true), { ok: true, value: true });
    r.epochMs(1_793_491_200, 't'); // seconds, not milliseconds
    assert.deepEqual(r.done(true), { ok: false, error: { code: 'bad_request', message: 'must be epoch milliseconds', field: 't' } });
  });

  it('recognises plain objects', () => {
    assert.equal(isPlainObject({}), true);
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject('x'), false);
  });
});

describe('sanitizers', () => {
  it('keeps a __proto__ prop as data', () => {
    const props = JSON.parse('{"__proto__":"x","a":1}') as Record<string, unknown>;
    assert.equal(sanitizeProps(props), '{"__proto__":"x","a":1}');
  });

  it('returns null when nothing survives', () => {
    assert.equal(sanitizeProps(null), null);
    assert.equal(sanitizeProps({ a: { b: 1 } }), null);
    assert.equal(sanitizeCounters(null), null);
    assert.equal(sanitizeCounters({ a: -1, 'b c': 2 }), null);
  });
});
