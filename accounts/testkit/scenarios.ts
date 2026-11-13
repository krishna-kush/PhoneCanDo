// The behaviour every store must give the routes: sign-in, sessions, the
// share list, settings, sign-out and Delete account, run as node:test cases against
// whichever store `makeStore` builds (memory and SQL both run it).

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_SETTINGS, MAX_SHARES, NONCE_TTL_MS, SESSION_IDLE_MS, SESSION_TOUCH_MS, SETTING_TEXT_MAX_CHARS } from '../core/limits.ts';
import type { AccountsStore } from '../core/store.ts';
import { createTestApi } from './api.ts';
import { fakeClock } from './clock.ts';
import { createTestSigner, googleClaims } from './google.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Registers the scenario suite for `name`. */
export function accountsScenarios(name: string, makeStore: () => AccountsStore): void {
  const setup = async (clientIds?: string[]) => {
    const clock = fakeClock();
    const signer = await createTestSigner();
    const store = makeStore();
    return { clock, signer, store, api: createTestApi(store, clock, signer, clientIds) };
  };

  describe(`accounts scenarios: ${name}`, () => {
    test('sign in, read the account, sign out', async () => {
      const { api, clock } = await setup();
      const token = await api.signIn();
      const me = await api.call('GET', '/v1/account', { token });
      assert.equal(me.status, 200);
      assert.deepEqual(me.json, { account: { email: 'friend@example.com', createdAt: clock.now() } });
      assert.deepEqual((await api.call('POST', '/v1/account/signout', { token })).json, { ok: true });
      const after = await api.call('GET', '/v1/account', { token });
      assert.equal(after.status, 401);
      assert.deepEqual(after.json, { error: 'signed_out' });
    });

    test('signin answers a token and the account; a second sign-in keeps the account and updates the email', async () => {
      const { api, clock } = await setup();
      const first = await api.signIn();
      const created = clock.now();
      clock.advance(DAY * 3);
      const second = await api.signIn({ email: 'new@example.com' });
      assert.notEqual(first, second);
      const me = await api.call('GET', '/v1/account', { token: first });
      assert.deepEqual(me.json, { account: { email: 'new@example.com', createdAt: created } });
    });

    test('a nonce works once', async () => {
      const { api, signer, clock } = await setup();
      const { nonce } = (await api.call('POST', '/v1/account/nonce')).json as { nonce: string };
      const idToken = await signer.sign(googleClaims(clock.now(), nonce));
      assert.equal((await api.call('POST', '/v1/account/signin', { body: { idToken, nonce } })).status, 200);
      const again = await api.call('POST', '/v1/account/signin', { body: { idToken, nonce } });
      assert.equal(again.status, 401);
      assert.deepEqual(again.json, { error: 'bad_token' });
    });

    test('a nonce expires after ten minutes', async () => {
      const { api, signer, clock } = await setup();
      const { nonce } = (await api.call('POST', '/v1/account/nonce')).json as { nonce: string };
      clock.advance(NONCE_TTL_MS + 1);
      const idToken = await signer.sign(googleClaims(clock.now(), nonce));
      assert.deepEqual((await api.call('POST', '/v1/account/signin', { body: { idToken, nonce } })).json, { error: 'bad_token' });
    });

    test('a nonce we never issued is refused', async () => {
      const { api, signer, clock } = await setup();
      const nonce = 'A'.repeat(43);
      const idToken = await signer.sign(googleClaims(clock.now(), nonce));
      assert.equal((await api.call('POST', '/v1/account/signin', { body: { idToken, nonce } })).status, 401);
    });

    test('a token for another nonce is refused and does not use up ours', async () => {
      const { api, signer, clock } = await setup();
      const { nonce } = (await api.call('POST', '/v1/account/nonce')).json as { nonce: string };
      const wrong = await signer.sign(googleClaims(clock.now(), 'B'.repeat(43)));
      assert.equal((await api.call('POST', '/v1/account/signin', { body: { idToken: wrong, nonce } })).status, 401);
      const right = await signer.sign(googleClaims(clock.now(), nonce));
      assert.equal((await api.call('POST', '/v1/account/signin', { body: { idToken: right, nonce } })).status, 200);
    });

    test('a session unused for 180 days is signed out; using it keeps it', async () => {
      const { api, clock } = await setup();
      const kept = await api.signIn();
      const idle = await api.signIn({ sub: 'other-person' });
      for (let used = 0; used < SESSION_IDLE_MS; used += 30 * DAY) {
        clock.advance(30 * DAY);
        assert.equal((await api.call('GET', '/v1/account', { token: kept })).status, 200);
      }
      clock.advance(SESSION_TOUCH_MS);
      assert.equal((await api.call('GET', '/v1/account', { token: kept })).status, 200);
      assert.deepEqual((await api.call('GET', '/v1/account', { token: idle })).json, { error: 'signed_out' });
    });

    test('calls without a session or with a made-up one are signed_out', async () => {
      const { api } = await setup();
      for (const [method, path] of [
        ['GET', '/v1/account'],
        ['PUT', '/v1/account/shares'],
        ['GET', '/v1/account/settings'],
        ['PUT', '/v1/account/settings'],
        ['POST', '/v1/account/signout'],
        ['POST', '/v1/account/delete'],
      ] as const) {
        assert.deepEqual((await api.call(method, path)).json, { error: 'signed_out' }, `${method} ${path} without token`);
        assert.equal((await api.call(method, path, { token: 'C'.repeat(43) })).status, 401, `${method} ${path} made-up token`);
        assert.equal((await api.call(method, path, { token: 'short' })).status, 401, `${method} ${path} malformed token`);
      }
    });

    test('shares: union of phones, earliest time wins, newest first', async () => {
      const { api } = await setup();
      const phoneA = await api.signIn();
      const phoneB = await api.signIn();
      const a = await api.call('PUT', '/v1/account/shares', {
        token: phoneA,
        body: { links: [{ code: 'aaaa2222', created: 1000 }, { code: 'bbbb3333', created: 3000 }] },
      });
      assert.deepEqual(a.json, { links: [{ code: 'bbbb3333', created: 3000 }, { code: 'aaaa2222', created: 1000 }] });
      const b = await api.call('PUT', '/v1/account/shares', {
        token: phoneB,
        body: { links: [{ code: 'bbbb3333', created: 2000 }, { code: 'cccc4444', created: 4000 }, { code: 'aaaa2222', created: 5000 }] },
      });
      assert.deepEqual(b.json, {
        links: [
          { code: 'cccc4444', created: 4000 },
          { code: 'bbbb3333', created: 2000 },
          { code: 'aaaa2222', created: 1000 },
        ],
      });
      // An empty list reads the account's links.
      assert.deepEqual((await api.call('PUT', '/v1/account/shares', { token: phoneA, body: { links: [] } })).json, b.json);
    });

    test('shares keep only the newest 500', async () => {
      const { api } = await setup();
      const token = await api.signIn();
      const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
      const code = (i: number): string => {
        let s = '';
        for (let n = i, d = 0; d < 7; d++, n = Math.floor(n / 32)) s += alphabet[n % 32];
        return `x${s}`;
      };
      const first = Array.from({ length: MAX_SHARES }, (_, i) => ({ code: code(i), created: 10_000 + i }));
      assert.equal(new Set(first.map((l) => l.code)).size, MAX_SHARES);
      assert.equal(((await api.call('PUT', '/v1/account/shares', { token, body: { links: first } })).json as { links: unknown[] }).links.length, MAX_SHARES);
      const newer = [{ code: 'zzzz2222', created: 99_999 }];
      const out = (await api.call('PUT', '/v1/account/shares', { token, body: { links: newer } })).json as { links: { code: string; created: number }[] };
      assert.equal(out.links.length, MAX_SHARES);
      assert.deepEqual(out.links[0], newer[0]);
      assert.ok(!out.links.some((l) => l.created === 10_000), 'the oldest link went');
    });

    test('shares refuse bad bodies', async () => {
      const { api } = await setup();
      const token = await api.signIn();
      const bad = [
        undefined,
        [],
        { links: 'x' },
        { links: [{ code: 'BAD', created: 1 }] },
        { links: [{ code: 'aaaa0000', created: 1 }] },
        { links: [{ code: 'aaaa2222', created: -1 }] },
        { links: [{ code: 'aaaa2222', created: 1.5 }] },
        { links: Array.from({ length: MAX_SHARES + 1 }, () => ({ code: 'aaaa2222', created: 1 })) },
      ];
      for (const body of bad) {
        assert.deepEqual((await api.call('PUT', '/v1/account/shares', { token, body })).json, { error: 'bad_request' }, JSON.stringify(body)?.slice(0, 60));
      }
    });

    test('settings: the later change wins per key, a tie keeps the account\'s', async () => {
      const { api } = await setup();
      const phoneA = await api.signIn();
      const phoneB = await api.signIn();
      assert.deepEqual((await api.call('GET', '/v1/account/settings', { token: phoneA })).json, { settings: {} });
      const a = await api.call('PUT', '/v1/account/settings', {
        token: phoneA,
        body: { settings: { themeMode: { value: 'dark', at: 2000 }, maxAgents: { value: 3, at: 1000 } } },
      });
      assert.deepEqual(a.json, { settings: { maxAgents: { value: 3, at: 1000 }, themeMode: { value: 'dark', at: 2000 } } });
      // Phone B changed the cap later and the theme earlier, and sends the
      // sticky keys the account never had; then a tie on the theme keeps the account's.
      const b = await api.call('PUT', '/v1/account/settings', {
        token: phoneB,
        body: {
          settings: {
            themeMode: { value: 'light', at: 1500 },
            maxAgents: { value: null, at: 3000 },
            extraKeysSticky: { value: true, at: 0 },
          },
        },
      });
      const merged = {
        settings: {
          extraKeysSticky: { value: true, at: 0 },
          maxAgents: { value: null, at: 3000 },
          themeMode: { value: 'dark', at: 2000 },
        },
      };
      assert.deepEqual(b.json, merged);
      await api.call('PUT', '/v1/account/settings', { token: phoneB, body: { settings: { themeMode: { value: 'system', at: 2000 } } } });
      assert.deepEqual((await api.call('GET', '/v1/account/settings', { token: phoneA })).json, merged);
    });

    test('settings keep only the most recently changed', async () => {
      const { api } = await setup();
      const token = await api.signIn();
      const first = Object.fromEntries(Array.from({ length: MAX_SETTINGS }, (_, i) => [`s${i}`, { value: i, at: 100 + i }]));
      await api.call('PUT', '/v1/account/settings', { token, body: { settings: first } });
      const out = (await api.call('PUT', '/v1/account/settings', { token, body: { settings: { newest: { value: 'x', at: 999 } } } }))
        .json as { settings: Record<string, unknown> };
      assert.equal(Object.keys(out.settings).length, MAX_SETTINGS);
      assert.ok('newest' in out.settings);
      assert.ok(!('s0' in out.settings), 'the least recently changed went');
    });

    test('settings refuse bad bodies', async () => {
      const { api } = await setup();
      const token = await api.signIn();
      const bad = [
        undefined,
        { settings: [] },
        { settings: { 'Bad-Key': { value: 1, at: 1 } } },
        { settings: { themeMode: 'dark' } },
        { settings: { themeMode: { value: { nested: true }, at: 1 } } },
        { settings: { themeMode: { value: 'x'.repeat(SETTING_TEXT_MAX_CHARS + 1), at: 1 } } },
        { settings: { themeMode: { value: 'dark', at: -1 } } },
        { settings: { themeMode: { value: 'dark', at: 1.5 } } },
        { settings: Object.fromEntries(Array.from({ length: MAX_SETTINGS + 1 }, (_, i) => [`s${i}`, { value: i, at: 1 }])) },
      ];
      for (const body of bad) {
        assert.deepEqual((await api.call('PUT', '/v1/account/settings', { token, body })).json, { error: 'bad_request' }, JSON.stringify(body)?.slice(0, 60));
      }
    });

    test('delete removes the account, every session, the share list and the settings', async () => {
      const { api } = await setup();
      const phoneA = await api.signIn();
      const phoneB = await api.signIn();
      await api.call('PUT', '/v1/account/shares', { token: phoneA, body: { links: [{ code: 'aaaa2222', created: 1 }] } });
      await api.call('PUT', '/v1/account/settings', { token: phoneA, body: { settings: { themeMode: { value: 'dark', at: 1 } } } });
      assert.deepEqual((await api.call('POST', '/v1/account/delete', { token: phoneA })).json, { deleted: true });
      assert.equal((await api.call('GET', '/v1/account', { token: phoneA })).status, 401);
      assert.equal((await api.call('GET', '/v1/account', { token: phoneB })).status, 401);
      // Signing in again starts a new, empty account.
      const fresh = await api.signIn();
      assert.deepEqual((await api.call('PUT', '/v1/account/shares', { token: fresh, body: { links: [] } })).json, { links: [] });
      assert.deepEqual((await api.call('GET', '/v1/account/settings', { token: fresh })).json, { settings: {} });
    });

    test('sign-out ends only that phone', async () => {
      const { api } = await setup();
      const phoneA = await api.signIn();
      const phoneB = await api.signIn();
      await api.call('POST', '/v1/account/signout', { token: phoneA });
      assert.equal((await api.call('GET', '/v1/account', { token: phoneB })).status, 200);
    });

    test('not_configured without client IDs; existing sessions are not the question', async () => {
      const { api } = await setup([]);
      for (const path of ['/v1/account/nonce', '/v1/account/signin']) {
        const res = await api.call('POST', path, { body: { idToken: 'x', nonce: 'A'.repeat(43) } });
        assert.equal(res.status, 503);
        assert.deepEqual(res.json, { error: 'not_configured' });
      }
    });

    test('signin refuses bad bodies before checking anything', async () => {
      const { api } = await setup();
      for (const body of [undefined, {}, { idToken: 1, nonce: 'A'.repeat(43) }, { idToken: 'x', nonce: 'short' }, { idToken: 'x'.repeat(5000), nonce: 'A'.repeat(43) }]) {
        assert.deepEqual((await api.call('POST', '/v1/account/signin', { body })).json, { error: 'bad_request' });
      }
    });
  });
}
