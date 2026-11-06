// Local dev entry (`pnpm -C tce dev`): sqlite store + node:http host.
//
// No rate limiting here (the Worker has it, hosts/cloudflare/config.ts). An own
// server exposed to the internet needs a limiter in front (reverse proxy or
// firewall rule per client address and path, e.g. nginx limit_req), or anyone
// can fill its disk through the public endpoints.
//
//   PORT              listen port, default 8787 (0 picks a free one)
//   HOST              listen address, default 127.0.0.1
//   TCE_DB            sqlite file, default <tce>/.data/tce.sqlite (':memory:' allowed)
//   ALLOWED_ORIGINS   comma list for /v1/hit, default this server's own origins
//   GITHUB_STATS_PAT  optional token for the GitHub traffic counters
//   RETENTION_ENABLED 'true' lets retention delete expired rows; default off (keep everything)

import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import app from '../../../app/app.json' with { type: 'json' };
import release from '../../../web/src/data/release.json' with { type: 'json' };
import { createSqliteStore } from '../../stores/sqlite/index.ts';
import { buildConfig, errorFields, jsonLogger } from '../../core/http.ts';
import { createNodeServer } from './server.ts';

const TCE_DIR = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// why: a forced exit beats a dev server that hangs on a stuck connection.
const SHUTDOWN_GRACE_MS = 5000;

const clock = { now: () => Date.now() };
const log = jsonLogger(console, { host: 'node' }, clock);

const port = parsePort(process.env['PORT']);
const host = process.env['HOST'] || '127.0.0.1';
const dbPath = process.env['TCE_DB'] || join(TCE_DIR, '.data', 'tce.sqlite');

if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const config = buildConfig({
  appVersion: app.expo.version,
  repo: release.repo,
  githubToken: process.env['GITHUB_STATS_PAT'],
  allowedOrigins: process.env['ALLOWED_ORIGINS'],
  defaultOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
  retentionEnabled: process.env['RETENTION_ENABLED'],
});

const { store, close } = createSqliteStore(dbPath, { clock, log });
const server = createNodeServer({ store, config, log, clock });

let closing = false;
async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (closing) return;
  closing = true;
  log.info('shutting down', { reason });
  const force = setTimeout(() => {
    log.error('shutdown timed out; exiting', { graceMs: SHUTDOWN_GRACE_MS });
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  force.unref();
  if (server.listening) {
    await new Promise<void>((done) => {
      server.close(() => done());
      server.closeIdleConnections();
    });
  }
  try {
    await close();
  } catch (e) {
    log.error('store close failed', errorFields(e));
    exitCode = 1;
  }
  process.exitCode = exitCode;
  log.info('stopped', { exitCode });
}

process.once('SIGINT', () => void shutdown('SIGINT', 0));
process.once('SIGTERM', () => void shutdown('SIGTERM', 0));

server.on('error', (e) => {
  log.error('server error', errorFields(e));
  void shutdown('server error', 1);
});

server.listen(port, host, () => {
  const address = server.address() as AddressInfo;
  log.info('tce dev server listening', {
    url: `http://${host}:${address.port}`,
    port: address.port,
    db: dbPath,
    release: config.release,
  });
});

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 8787;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`PORT must be an integer 0-65535, got '${raw}'`);
  }
  return n;
}
