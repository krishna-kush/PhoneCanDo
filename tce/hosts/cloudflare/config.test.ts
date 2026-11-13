// hosts/cloudflare/config.ts without the runtime: TceConfig from bindings,
// the rate limit subject (IPv4 as is, IPv6 by /64), the limiter's decisions
// and its log hygiene. index.test.ts drives the same limiter end to end.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AnyHttpOp, Logger } from '../../core/op.ts';
import { httpOps } from '../../core/ops/registry.ts';
import { RATE_LIMIT_BINDINGS, configFromEnv, rateLimitSubject, rateLimiter, scrubAddresses } from './config.ts';
import type { Env } from './config.ts';

/** The bindings a test env needs; nothing here touches them except the limiters. */
function env(over: Partial<Env> = {}): Env {
  return { ASSETS: {} as Fetcher, DB: {} as D1Database, ...over };
}

/** Logger that keeps every line. */
function memoryLog(): Logger & { lines: { level: string; message: string; data?: Record<string, unknown> }[] } {
  const lines: { level: string; message: string; data?: Record<string, unknown> }[] = [];
  const at = (level: string) => (message: string, data?: Record<string, unknown>) => void lines.push({ level, message, ...(data ? { data } : {}) });
  return { lines, info: at('info'), warn: at('warn'), error: at('error') };
}

/** Limiter fake answering `success` (or throwing) and recording keys. */
function limiter(answer: () => boolean | undefined, keys: string[] = []): RateLimit & { keys: string[] } {
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      return { success: answer() } as RateLimitOutcome;
    },
  };
}

const op = (name: string): AnyHttpOp => {
  const found = httpOps.find((o) => o.name === name);
  assert.ok(found, name);
  return found;
};

/** Compile-time: the Worker binds no R2 bucket any more (cold storage was removed). */
const noArchiveBinding: 'ARCHIVE' extends keyof Env ? never : true = true;

describe('configFromEnv', () => {
  it('builds exactly the TceConfig fields; the env has no ARCHIVE binding', () => {
    assert.equal(noArchiveBinding, true);
    assert.deepEqual(Object.keys(configFromEnv(env())).sort(), ['allowedOrigins', 'githubToken', 'release', 'retentionEnabled']);
  });

  it('keeps retention off unless RETENTION_ENABLED is exactly "true" (any case)', () => {
    assert.equal(configFromEnv(env()).retentionEnabled, false);
    assert.equal(configFromEnv(env({ RETENTION_ENABLED: 'false' })).retentionEnabled, false);
    assert.equal(configFromEnv(env({ RETENTION_ENABLED: '1' })).retentionEnabled, false);
    assert.equal(configFromEnv(env({ RETENTION_ENABLED: 'true' })).retentionEnabled, true);
    assert.equal(configFromEnv(env({ RETENTION_ENABLED: 'TRUE' })).retentionEnabled, true);
  });

  it('reads origins and the optional GitHub token from vars and secrets', () => {
    const c = configFromEnv(env({ ALLOWED_ORIGINS: 'https://a.example, https://b.example', GITHUB_STATS_PAT: 'tok' }));
    assert.deepEqual(c.allowedOrigins, ['https://a.example', 'https://b.example']);
    assert.equal(c.githubToken, 'tok');
    assert.equal(configFromEnv(env()).githubToken, null);
    assert.match(c.release.version, /^\d+\.\d+\.\d+/);
  });
});

describe('rateLimitSubject', () => {
  it('keeps an IPv4 address as is', () => {
    assert.equal(rateLimitSubject('203.0.113.77'), '203.0.113.77');
    assert.equal(rateLimitSubject(' 198.51.100.1 '), '198.51.100.1');
  });

  it('reduces IPv6 to its /64 network, whatever the spelling', () => {
    const net = '2001:db8:85a3:12::/64';
    for (const ip of [
      '2001:db8:85a3:12:8a2e:370:7334:1',
      '2001:0DB8:85A3:0012:ffff:ffff:ffff:ffff',
      '2001:db8:85a3:12::1',
      '2001:db8:85a3:12::',
      '2001:db8:85a3:12:0:0:0:0',
      'fe80::1%eth0'.replace('fe80::1', '2001:db8:85a3:12::9'),
    ]) {
      assert.equal(rateLimitSubject(ip), net, ip);
    }
    assert.equal(rateLimitSubject('::1'), '0:0:0:0::/64');
    assert.equal(rateLimitSubject('2001:db8::'), '2001:db8:0:0::/64');
    assert.equal(rateLimitSubject('64:ff9b::192.0.2.33'), '64:ff9b:0:0::/64');
    assert.notEqual(rateLimitSubject('2001:db8:85a3:13::1'), net, 'the next /64 is another subject');
  });

  it('treats an IPv4-mapped IPv6 address as its IPv4 address', () => {
    assert.equal(rateLimitSubject('::ffff:203.0.113.77'), '203.0.113.77');
    assert.equal(rateLimitSubject('::ffff:cb00:714d'), '203.0.113.77');
  });

  it('uses unparseable values verbatim and returns null for empty ones', () => {
    for (const odd of ['1:2:3', '1::2::3', 'gggg::1', '1:2:3:4:5:6:7:8:9', '::ffff:300.1.1.1', 'not-an-ip']) {
      assert.equal(rateLimitSubject(odd), odd.toLowerCase(), odd);
    }
    assert.equal(rateLimitSubject(''), null);
    assert.equal(rateLimitSubject('   '), null);
  });
});

describe('rateLimiter', () => {
  it('maps every http op to a limiter binding', () => {
    for (const o of httpOps) assert.ok(Object.hasOwn(RATE_LIMIT_BINDINGS, o.name), o.name);
    assert.deepEqual(RATE_LIMIT_BINDINGS, {
      batch: 'RL_INGEST',
      report: 'RL_RARE',
      forget: 'RL_RARE',
      hit: 'RL_PUBLIC',
      download: 'RL_PUBLIC',
      health: 'RL_PUBLIC',
      share_open: 'RL_PUBLIC',
      share_stats: 'RL_PUBLIC',
    });
  });

  it('asks the op binding with `<op>:<subject>` and passes its answer through', async () => {
    const keys: string[] = [];
    let answer = false;
    const rl = limiter(() => answer, keys);
    const limit = rateLimiter(env({ RL_INGEST: rl, RL_RARE: rl, RL_PUBLIC: rl }), '2001:db8:85a3:12::7', memoryLog());
    assert.ok(limit);
    assert.equal(await limit(op('batch')), false);
    answer = true;
    assert.equal(await limit(op('forget')), true);
    assert.equal(await limit(op('download')), true);
    assert.deepEqual(keys, ['batch:2001:db8:85a3:12::/64', 'forget:2001:db8:85a3:12::/64', 'download:2001:db8:85a3:12::/64']);
  });

  it('allows without asking when the op has no binding, the binding is absent, or the answer is malformed', async () => {
    const keys: string[] = [];
    const limit = rateLimiter(env({ RL_PUBLIC: limiter(() => undefined, keys) }), '203.0.113.77', memoryLog());
    assert.ok(limit);
    assert.equal(await limit(op('batch')), true, 'RL_INGEST absent');
    assert.equal(await limit({ ...op('batch'), name: 'constructor' }), true, 'unmapped op name');
    assert.equal(await limit(op('hit')), true, 'success missing counts as allowed');
    assert.deepEqual(keys, ['hit:203.0.113.77']);
  });

  it('is undefined without a client address (no limiter at all)', () => {
    const rl = limiter(() => false);
    assert.equal(rateLimiter(env({ RL_INGEST: rl }), null, memoryLog()), undefined);
    assert.equal(rateLimiter(env({ RL_INGEST: rl }), '', memoryLog()), undefined);
    assert.deepEqual(rl.keys, []);
  });

  it('allows when the binding throws and logs the failure without the address', async () => {
    const log = memoryLog();
    const ip = '2001:db8:85a3:12:8a2e:370:7334:1';
    const limit = rateLimiter(
      env({
        RL_RARE: {
          limit: async ({ key }) => {
            throw new TypeError(`no capacity for ${key}; client ${ip} / ${ip.toUpperCase()} via 198.51.100.4`);
          },
        },
      }),
      ip,
      log,
    );
    assert.ok(limit);
    assert.equal(await limit(op('report')), true);
    assert.equal(log.lines.length, 1);
    const line = JSON.stringify(log.lines[0]);
    assert.equal(log.lines[0]!.message, 'rate limiter failed; request allowed');
    assert.deepEqual({ op: log.lines[0]!.data?.['op'], binding: log.lines[0]!.data?.['binding'] }, { op: 'report', binding: 'RL_RARE' });
    for (const needle of [ip, ip.toUpperCase(), '2001:db8:85a3:12', '2001:DB8', '198.51.100.4']) assert.ok(!line.includes(needle), `${needle} in ${line}`);
    assert.match(line, /TypeError: no capacity for report:\[addr\]/);
  });
});

describe('scrubAddresses', () => {
  it('replaces IPv4, IPv6 and given values, keeps the rest', () => {
    assert.equal(scrubAddresses(new Error('from 203.0.113.77 and ::ffff:10.0.0.1 and fe80::1:2 ok')), 'Error: from [addr] and [addr] and [addr] ok');
    assert.equal(scrubAddresses('key batch:secret-subject', ['secret-subject']), 'key batch:[addr]');
    assert.equal(scrubAddresses('quota exceeded'), 'quota exceeded');
  });
});
