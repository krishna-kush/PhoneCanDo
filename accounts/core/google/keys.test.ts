import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeClock } from '../../testkit/clock.ts';
import { createKeyCache, maxAgeOf, parseJwks, type JwksFetch } from './keys.ts';

const KEY = (kid: string) => ({ kty: 'RSA', kid, n: 'nn', e: 'AQAB', alg: 'RS256', use: 'sig' });

function source(sets: unknown[][], maxAgeS: number | null = 600) {
  let calls = 0;
  const fetchJwks: JwksFetch = async () => {
    const set = sets[Math.min(calls, sets.length - 1)];
    calls++;
    if (set === undefined) throw new Error('down');
    return { keys: set, maxAgeS };
  };
  return { fetchJwks, calls: () => calls };
}

test('keeps a set for its max-age, then fetches again', async () => {
  const clock = fakeClock();
  const s = source([[KEY('a')], [KEY('b')]]);
  const cache = createKeyCache(s.fetchJwks, clock);
  assert.equal((await cache.key('a'))?.kid, 'a');
  assert.equal((await cache.key('a'))?.kid, 'a');
  assert.equal(s.calls(), 1);
  clock.advance(600_000);
  assert.equal(await cache.key('a'), null);
  assert.equal((await cache.key('b'))?.kid, 'b');
  assert.equal(s.calls(), 2);
});

test('an unknown kid fetches again at most once a minute', async () => {
  const clock = fakeClock();
  const s = source([[KEY('a')], [KEY('a'), KEY('new')]]);
  const cache = createKeyCache(s.fetchJwks, clock);
  await cache.key('a');
  assert.equal(await cache.key('new'), null);
  assert.equal(await cache.key('junk'), null);
  assert.equal(s.calls(), 1);
  clock.advance(60_000);
  assert.equal((await cache.key('new'))?.kid, 'new');
  assert.equal(s.calls(), 2);
});

test('a stale set still answers while Google is down; no set at all throws', async () => {
  const clock = fakeClock();
  let up = true;
  const cache = createKeyCache(async () => {
    if (!up) throw new Error('down');
    return { keys: [KEY('a')], maxAgeS: 60 };
  }, clock);
  await cache.key('a');
  up = false;
  clock.advance(120_000);
  assert.equal((await cache.key('a'))?.kid, 'a');
  const empty = createKeyCache(async () => {
    throw new Error('down');
  }, clock);
  await assert.rejects(empty.key('a'));
  await assert.rejects(empty.key('a')); // within the minute: no fetch, still no keys
});

test('concurrent misses share one fetch', async () => {
  const clock = fakeClock();
  const s = source([[KEY('a')]]);
  const cache = createKeyCache(s.fetchJwks, clock);
  await Promise.all([cache.key('a'), cache.key('a'), cache.key('a')]);
  assert.equal(s.calls(), 1);
});

test('parseJwks keeps RSA signing keys only', () => {
  const got = parseJwks([KEY('a'), { ...KEY('b'), alg: 'RS512' }, { ...KEY('c'), use: 'enc' }, { kty: 'EC', kid: 'd' }, null, 'x']);
  assert.deepEqual([...got.keys()], ['a']);
  assert.equal(parseJwks('nope').size, 0);
});

test('maxAgeOf reads Cache-Control', () => {
  assert.equal(maxAgeOf('public, max-age=19830, must-revalidate, no-transform'), 19830);
  assert.equal(maxAgeOf('no-store'), null);
  assert.equal(maxAgeOf(null), null);
});
