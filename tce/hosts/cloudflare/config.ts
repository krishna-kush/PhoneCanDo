// What the Worker reads from its environment: bindings and vars (Env), the
// TceConfig built from them, and the per-op rate limiter over the Workers
// Rate Limiting bindings. Kept out of index.ts because workerd treats every
// named export of the entry module as a candidate entrypoint.

import app from '../../../app/app.json' with { type: 'json' };
import release from '../../../web/src/data/release.json' with { type: 'json' };
import type { AnyHttpOp, Logger, TceConfig } from '../../core/op.ts';
import { buildConfig } from '../../core/http.ts';
import type { DispatchOptions } from '../../core/http.ts';

/** Bindings and vars declared in wrangler.jsonc. */
export interface Env {
  /** web/dist, served for every path outside /api/* and /dl/*. */
  ASSETS: Fetcher;
  DB: D1Database;
  PAGEVIEWS?: AnalyticsEngineDataset;
  DOWNLOADS?: AnalyticsEngineDataset;
  /** Rate limiter for /api/batch. Absent: not limited. */
  RL_INGEST?: RateLimit;
  /** Rate limiter for /api/report and /api/forget. Absent: not limited. */
  RL_RARE?: RateLimit;
  /** Rate limiter for /api/hit, /dl/* and /api/health. Absent: not limited. */
  RL_PUBLIC?: RateLimit;
  /** Comma list of origins allowed to post /api/hit. */
  ALLOWED_ORIGINS?: string;
  /** 'true' lets the retention cron delete expired rows; anything else (the default) keeps everything. */
  RETENTION_ENABLED?: string;
  /** Optional secret: fine-grained PAT (Administration: read) for GitHub traffic. */
  GITHUB_STATS_PAT?: string;
}

/** Names of the rate limiting bindings. */
export type RateLimitBinding = 'RL_INGEST' | 'RL_RARE' | 'RL_PUBLIC';

/**
 * Which limiter counts each http op (by op name). Every op in the registry is
 * listed (hosts/cloudflare/index.test.ts checks it), so a new op gets a
 * deliberate choice instead of silently going unlimited.
 */
export const RATE_LIMIT_BINDINGS: Readonly<Record<string, RateLimitBinding>> = {
  batch: 'RL_INGEST',
  report: 'RL_RARE',
  forget: 'RL_RARE',
  hit: 'RL_PUBLIC',
  download: 'RL_PUBLIC',
  // Public and bodiless, polled by the build's limit check; each call costs one D1 query.
  health: 'RL_PUBLIC',
};

/** TceConfig from the bundled release facts and the Worker's vars, secrets and bindings. */
export function configFromEnv(env: Env): TceConfig {
  return buildConfig({
    appVersion: app.expo.version,
    repo: release.repo,
    githubToken: env.GITHUB_STATS_PAT,
    allowedOrigins: env.ALLOWED_ORIGINS,
    retentionEnabled: env.RETENTION_ENABLED,
  });
}

/** Parses an IPv6 address into its eight 16-bit groups, or null when it is not one. */
function ipv6Groups(text: string): number[] | null {
  let s = text;
  // An embedded IPv4 tail (::ffff:192.0.2.1) becomes two groups.
  const v4 = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const b = v4.slice(2).map(Number);
    if (b.some((n) => n > 255)) return null;
    s = `${v4[1]}${((b[0]! << 8) | b[1]!).toString(16)}:${((b[2]! << 8) | b[3]!).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const part = (p: string): string[] => (p === '' ? [] : p.split(':'));
  const head = part(halves[0]!);
  const tail = halves.length === 2 ? part(halves[1]!) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * The part of a client address a rate limit counts: an IPv4 address as is, an
 * IPv6 address by its /64 network (an IPv4-mapped one as its IPv4 address).
 * Why /64: one subscriber line or phone gets a whole /64 and can rotate through
 * it freely (privacy addresses do so on their own), so a per-address key would
 * not limit anyone on IPv6. Anything unparseable is used verbatim. Null for an
 * empty value.
 */
export function rateLimitSubject(clientIp: string): string | null {
  const ip = clientIp.trim().toLowerCase().replace(/%.*$/, '');
  if (ip === '') return null;
  if (!ip.includes(':')) return ip;
  const g = ipv6Groups(ip);
  if (g === null) return ip;
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) {
    return `${g[6]! >> 8}.${g[6]! & 0xff}.${g[7]! >> 8}.${g[7]! & 0xff}`;
  }
  return `${g
    .slice(0, 4)
    .map((n) => n.toString(16))
    .join(':')}::/64`;
}

/**
 * The dispatch limiter for one request: asks the op's binding with the key
 * `${op.name}:${subject}`. The address is used only as that key: it is never
 * logged, never handed to an op and never stored. No address (a request that
 * did not come through Cloudflare's edge), no binding for the op, or a binding
 * that fails: the request is allowed. Undefined when there is nothing to key on.
 */
export function rateLimiter(env: Env, clientIp: string | null, log: Logger): DispatchOptions['limit'] {
  const subject = clientIp === null ? null : rateLimitSubject(clientIp);
  if (subject === null) return undefined;
  return async (op: AnyHttpOp): Promise<boolean> => {
    const name = Object.hasOwn(RATE_LIMIT_BINDINGS, op.name) ? RATE_LIMIT_BINDINGS[op.name] : undefined;
    const binding = name === undefined ? undefined : env[name];
    if (!binding) return true;
    try {
      const outcome = await binding.limit({ key: `${op.name}:${subject}` });
      return outcome?.success !== false;
    } catch (e) {
      // Caught here rather than by dispatch so the error text can be scrubbed:
      // a binding's message could echo the key, and the key holds the address.
      log.warn('rate limiter failed; request allowed', { op: op.name, binding: name, error: scrubAddresses(e, [subject, clientIp!]) });
      return true;
    }
  };
}

/** A thrown value's message with every address-like substring (and the given values) replaced, for logs. */
export function scrubAddresses(e: unknown, known: readonly string[] = []): string {
  let text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  for (const k of known) {
    const v = k.trim();
    if (v !== '') text = text.split(v).join('[addr]');
  }
  return text
    // IPv6 with an IPv4 tail first, so ::ffff:10.0.0.1 goes as one address.
    .replace(/(?:[0-9a-f]{0,4}:){2,7}\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?:\/\d{1,3})?/gi, (m) =>
      /[0-9a-f]/i.test(m) ? '[addr]' : m,
    )
    .replace(/\d{1,3}(?:\.\d{1,3}){3}/g, '[addr]');
}
