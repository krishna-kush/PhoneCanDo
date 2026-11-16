// stats, data and limits: our usage numbers, all read-only (tce/scripts/;
// see tce/README.md).
import { join } from 'node:path';
import { releaseEnv } from '../env.mjs';
import { TCE } from '../paths.mjs';
import { sh } from '../run.mjs';

// GITHUB_TOKEN (optional) raises the API rate limit; --d1 needs the cf CLI
// logged in.
export function stats(args) {
  sh(['node', join(TCE, 'scripts', 'stats.mjs'), ...args]);
}

// D1 through TCE_READ_TOKEN (from .env; it also adds the Analytics Engine
// detail) or else the cf CLI login. Interactive in a terminal; --report
// prints the plain report.
export function data(args) {
  sh(['node', join(TCE, 'scripts', 'data.mjs'), ...args], { env: releaseEnv() });
}

// GET /v1/health on the live API host; with CLOUDFLARE_API_TOKEN and
// CLOUDFLARE_ACCOUNT_ID also today's D1 rows and Worker requests.
export function limits(args) {
  sh(['node', join(TCE, 'scripts', 'check-limits.mjs'), ...args]);
}
