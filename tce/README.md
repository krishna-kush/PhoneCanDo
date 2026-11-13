# TCE: Telemetry Collection Engine

PhoneCanDo's usage-data backend and client SDK, and the Cloudflare Worker that
serves the website. A pure core (schema, validation, operations) sits behind a
`Store` interface and thin hosts, so Cloudflare can be swapped for another
platform by replacing one folder.

- Rules (boundary, dependency law, privacy law): [`AGENTS.md`](AGENTS.md)
- Published schema, retention, controls: [`../docs/telemetry.md`](../docs/telemetry.md)
- Open work: [`docs/planning/todo.md`](docs/planning/todo.md); settled decisions: [`docs/planning/decisions.md`](docs/planning/decisions.md)

## Layout

| Path | What |
|---|---|
| `core/` | Pure: wire and row schema (`schema/`), identity, validation, redaction, the ops (`ops/`, one file each, listed in `ops/registry.ts`), the `Store` interface. No platform imports. |
| `client/` | Pure SDK the app's adapter (`app/src/engine/telemetry/`) wraps: queue, batching, truncation, retry, on/off, forget. |
| `testkit/` | `StoreContract` every store passes, fixtures, test contexts. |
| `stores/memory/` | In-memory store for tests. |
| `stores/sql/` | Shared SQL store and `migrations/` (D1 and sqlite run the same SQL). |
| `stores/sqlite/` | `node:sqlite` store: local dev, or an own server. |
| `stores/cloudflare/` | D1 (with the storage guard) + Analytics Engine. |
| `hosts/node/` | `node:http` server over the sqlite store. |
| `hosts/cloudflare/` | The `phonecando` Worker: `index.ts` and `wrangler.jsonc`. |
| `scripts/` | `typecheck.mjs`, `check-deps.mjs`, `stats.mjs`, `check-limits.mjs` (free-plan capacity check), `data.mjs` with `data/` (usage data, interactive or as a report) and their small helpers, with `*.test.mjs`. |

## Routes and crons

The ops answer only on the API host, `https://api.phonecando.app` (the
Worker var `API_HOSTS`), all under `/v1/`. On every other host, the site's
`phonecando.app` included, `/v1/*` is the static site's 404, so the site
keeps all its paths for pages. The one exception is the share links,
`/i/<code>`: they answer on every host that is not an API host (the site's
own domain, the link people open) and are the site's 404 on the API host
(`SITE_OP_PATH_PREFIXES` in `core/http.ts`). `pnpm -C tce cf:dev` sets
`API_HOSTS` to `localhost`; with it unset (the Worker tests), every host
answers both.

| Op | Route / schedule (UTC) | Does |
|---|---|---|
| `batch` | `POST /v1/batch` | app identity, device, sessions, events, errors → D1; `share.sent` / `share.install` events also add `share_links` / `share_installs` (`core/share.ts`) |
| `report` | `POST /v1/report` | a user's Send report → `reports`; also upserts the phone's `devices` row (pins its verifier) |
| `forget` | `POST /v1/forget` | Delete my data: every row of that device, its share links with their counts and installs, and its own install through a link |
| `hit` | `POST /v1/hit` | site page view → Analytics Engine, +1 on `site_daily` |
| `download` | `GET /v1/dl/lite`, `GET /v1/dl/full` | count (Analytics Engine; +1 on `site_daily` only for a person's browser: `Sec-Fetch-Mode: navigate` and no bot user agent, else the point's class is `bot`; with `?i=<code>` also +1 `download` on that share link's `share_daily`), then 302 to the current version's GitHub APK |
| `share_open` | `GET /i/<code>` (site host) | a share link opened: +1 `open` on `share_daily` for a person's browser (the download rule), then 302 to `/?i=<code>` |
| `share_stats` | `POST /v1/share/stats` | each share code's totals (opened, downloaded, installed, using, last day); no identity |
| `health` | `GET /v1/health` | public capacity facts: database size, limit, ratios, `ingestPaused`, the retention switch and the oldest kept row's age per table (`HealthResponse` in `core/schema/wire.ts`); no identity, never cached |
| `github_daily` | `17 3 * * *` | GitHub's release and repo counters → D1 |
| `retention` | not scheduled (would be `*/15 * * * *`) | **currently off**; when on: reports > 90 days deleted first, then events > 90 days, errors > 180 days ([Retention](#retention)) |

Every other path, on any host, is the static site (`../web/dist`, the
Worker's assets).

## Retention

**Switched off for now** (decided 2026-11-06): we keep all data until the
backup exists. The retention op is not scheduled (no cron for it in
`core/ops/registry.ts` or `hosts/cloudflare/wrangler.jsonc`), and the Worker var
`RETENTION_ENABLED` is `"false"`. The code below stays tested. The published
docs and privacy page still promise the ages below, so the limit check
(`./manage limits`, every build) warns 14 days before the oldest kept row
reaches them and says CRITICAL after (`scripts/retention-watch.mjs`).

To turn deletion on: add `retentionOp` to `cronOps` in `core/ops/registry.ts`,
add `"*/15 * * * *"` to `triggers.crons` in `hosts/cloudflare/wrangler.jsonc`,
set `RETENTION_ENABLED` to `"true"` there, and push. The node host reads
`RETENTION_ENABLED` from its environment.

When on, the `retention` cron keeps D1 inside the free plan's 500 MB
(`RETENTION_DAYS` and `RETENTION_RUN` in `core/schema/limits.ts`):

- **Reports** are deleted after 90 days, first in every run, so a run cut
  short by the CPU limit never skips them.
- **Events and errors**: per table and run, at most 250 expired rows, oldest
  first, are deleted (about 10 ms of CPU per free run; the rest waits for the
  next run, 96 runs a day).
- **No cold storage:** expired rows are gone (after D1's 7-day Time Travel).
  A backup is planned for when the database nears its limit, not before
  (`docs/planning/todo.md`, Backup).
- **`site_daily`** (daily page view and download totals, no identity) and the
  GitHub counters are kept for good; Analytics Engine keeps the detailed
  points about 3 months.

A report also upserts the phone's `devices` row with the same merge and
ownership rules as a batch, in one atomic write. A phone that only ever sent a
report is therefore pinned to its verifier, so Delete my data finds and
deletes that report.

## Capacity

`scripts/check-limits.mjs` (`./manage limits`) compares usage with the free
plan (`CAPACITY` in `core/schema/limits.ts`): the database size from
`GET /v1/health` and, when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
are set (a read-only token: Account Analytics: Read, D1: Read), today's D1 rows
read and written and the Worker's requests from Cloudflare's GraphQL Analytics
API. It warns from 70% of a limit and says CRITICAL from 90% (where the
storage guard pauses ingest); storage warnings point to the backup plan. It
exits 0 unless `--strict` is passed (then 1 from 90%), so it never blocks a
build. It runs before `./manage build` and `./manage release`, in the
`capacity` job of `tce.yml`, and at the end of the Workers Builds build
command (Deploys).

## Usage data

`scripts/data.mjs` (`./manage data`, `pnpm -C tce data`) reads what the app and
the site have sent: devices, installs and versions, sessions with engine and
phone health, events, errors, reports, site traffic, and the GitHub counters.
In a terminal it is a full-screen view: tabs (`1`–`9`, arrows), scrolling, the
stack frames of an error and the note, phone and log of a report (enter),
the window (`w`: 7, 30 or 90 days), our tester devices (`t`, hidden by
default) and reload (`r`); `?` lists the keys. Elsewhere, or with `--report`,
it prints the same screens as text, aggregates only: no report notes, logs or
stack frames, and never a device id. `--json` prints everything.

Only SELECTs run (`data/queries.mjs`). Each refresh is one D1 batch whose
rows read count toward the free plan's 5M a day; the output says how many.
Sources (`data/source.mjs`):

- `TCE_READ_TOKEN`: a read-only API token with D1: Read and Account
  Analytics: Read (the second adds the Analytics Engine detail: bots apart,
  referrers), from the environment or the repo-root `.env` (`.env.example`;
  only this key and `CLOUDFLARE_ACCOUNT_ID` are read from it).
  `CLOUDFLARE_API_TOKEN` works too. Set `CLOUDFLARE_ACCOUNT_ID` next to it: a
  read-only token usually cannot look up its account (only when it can, and
  sees exactly one, is the variable optional).
- otherwise the logged-in `cf` CLI (D1 only).

The report runs after the limit check in `./manage build` and
`./manage release`, and never blocks them. It runs only on our own machines:
it skips itself under GitHub Actions (public logs; usage data never goes to
GitHub) and under Workers Builds (usage data stays out of Cloudflare's build
logs), so the token is never a build secret.

## Commands

| Command | Does |
|---|---|
| `pnpm -C tce install --frozen-lockfile` | deps (Node ≥ 22.18, pnpm 11) |
| `pnpm -C tce check` | `tsc` per module, then the dependency law |
| `pnpm -C tce test` | `node --test` over every `*.test.ts` (sources run directly, type stripping) |
| `node --test 'tce/scripts/**/*.test.mjs'` | the scripts' tests (check-limits and data with Cloudflare mocked, stats helpers) |
| `pnpm -C tce dev` | node host + sqlite on `http://127.0.0.1:8787` (`PORT`, `HOST`, `TCE_DB`; data in `tce/.data/`) |
| `pnpm -C tce cf:dev` | the Worker under `wrangler dev --local` with simulated D1 and AE; build the site first (`pnpm -C web build`) |
| `pnpm -C tce stats`, `./manage stats [--d1]` | GitHub download counts; `--d1` adds read-only D1 summaries through the `cf` CLI, including `site_daily` (downloads per channel per day, top paths, all-time totals) |
| `./manage limits [--strict]` | usage against the free plan ([Capacity](#capacity)); `TCE_BASE` picks another site |
| `./manage data [--days N] [--testers] [--report \| --json]` | usage data, interactive in a terminal ([Usage data](#usage-data)) |

CI: [`../.github/workflows/tce.yml`](../.github/workflows/tce.yml) runs check
(with the scripts' tests), the tests on Node 22 and 24, and a credential-free
`wrangler deploy --dry-run` of the Worker; outside pull requests its
`capacity` job runs the limit check (optional secret
`CLOUDFLARE_ANALYTICS_TOKEN`, variable `CLOUDFLARE_ACCOUNT_ID`), never as a
gate.

## Deploys

There is no local deploy step. Cloudflare Workers Builds, connected to the
GitHub repo, builds and deploys the Worker on every push to `prod`:

- root directory: `/` (Cloudflare first runs `pnpm install --frozen-lockfile` there)
- build: `pnpm -C web install --frozen-lockfile && pnpm -C web build && pnpm -C tce install --frozen-lockfile && (node tce/scripts/check-limits.mjs || true)`
- deploy: `pnpm -C tce exec wrangler deploy -c hosts/cloudflare/wrangler.jsonc --experimental-provision=false`

`--experimental-provision=false` stops a deploy from creating a resource
(a D1 database, for one) for a binding that has no id, so every resource stays
an approved, deliberate creation.

The build ends with the limit check, which only prints (health only: it skips
the Cloudflare API under Workers Builds). The parentheses keep `|| true` to the
check alone, so a failed site build still fails the build.

Those trigger settings live in Cloudflare, not in the repo. Changing them, or
any Cloudflare resource (D1, secrets), needs explicit approval for that exact command
for that exact command (`AGENTS.md` §6).

**Schema changes are applied before the push, not by the build.** The build's
API token (created by Workers Builds) has no D1 permission. Add
`stores/sql/migrations/000N_*.sql`, then apply it to the remote database with
the `cf` CLI (it records migrations in the same `d1_migrations` table wrangler
uses), then push:

```sh
cf d1 migrations apply 64a28b32-a61f-4ad8-b9a4-c7ae7cea8b66 --dir tce/stores/sql/migrations
```

Migrations must stay backward compatible with the Worker still live (add
columns and tables; never drop or rename in the same release).
