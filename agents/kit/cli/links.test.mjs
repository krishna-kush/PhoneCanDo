// links.mjs: which links it checks and what each answer means.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, exitCode, linksOf } from './links.mjs';

describe('links.mjs', () => {
  it("checks every kind's about.links, in manifest order", () => {
    const entries = [
      { id: 'a', manifest: { about: { checked: 'x', links: { home: 'https://a.example', keys: 'https://a.example/k' } } } },
      { id: 'b', manifest: {} },
      { id: 'c', manifest: { about: { checked: 'x' } } },
    ];
    assert.deepEqual(linksOf(entries), [
      { id: 'a', name: 'home', url: 'https://a.example' },
      { id: 'a', name: 'keys', url: 'https://a.example/k' },
    ]);
  });

  it('a page is fine, and so is a sign-in wall', () => {
    assert.deepEqual([200, 204, 301].map(classify), ['ok', 'ok', 'ok']);
    assert.deepEqual([401, 403, 429].map(classify), ['gated', 'gated', 'gated']);
  });

  it('gone pages and gone hosts are broken; server trouble and timeouts are not', () => {
    assert.deepEqual([404, 410, 400].map(classify), ['broken', 'broken', 'broken']);
    assert.equal(classify(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })), 'broken');
    assert.deepEqual([500, 503].map(classify), ['flaky', 'flaky']);
    assert.equal(classify(new DOMException('timed out', 'TimeoutError')), 'flaky');
    assert.equal(classify(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })), 'flaky');
  });

  it('fails the run only for a broken link', () => {
    assert.equal(exitCode([{ verdict: 'ok' }, { verdict: 'gated' }, { verdict: 'flaky' }]), 0);
    assert.equal(exitCode([{ verdict: 'ok' }, { verdict: 'broken' }]), 1);
  });
});
