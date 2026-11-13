# TCE rules — read before touching `tce/`

`tce/` is the Telemetry Collection Engine: PhoneCanDo's usage-data backend and
client SDK, built so the hosting platform can be swapped by replacing one
folder. Every rule here is a quality gate, enforced by `pnpm -C tce check`
(type-check per module + `scripts/check-deps.mjs`) and `pnpm -C tce test`.

## 1. Product boundary

`tce/` owns: the wire and storage schema, identity rules, validation and
truncation, operations, the `Store` interface and its implementations, host
adapters, crons, the client SDK, SQL migrations, its tests and docs.

The app owns: the React Native adapter (`app/src/engine/telemetry/`), consent
UI, Settings, flush timing, and the Kotlin counters in `phonecando-runner`. The
site owns its markup and the one-line beacon call. Neither imports a store, a
host or a platform type. If a change needs `D1Database`,
`AnalyticsEngineDataset`, a rate-limit binding, `node:sqlite` or an AWS SDK type, it belongs in
`stores/<name>/` or `hosts/<name>/` and nowhere else.

## 2. Dependency law (`scripts/check-deps.mjs` is the source of truth)

```
core                      <- everything
client          -> core
testkit         -> core
stores/memory   -> core
stores/sql      -> core
stores/sqlite   -> core, stores/sql
stores/cloudflare -> core, stores/sql
hosts/node      -> core, stores/sqlite
hosts/cloudflare -> core, stores/cloudflare
app/src/engine/telemetry/ -> client, core   (the only code outside tce that imports tce)
```

- `core`, `client`, `testkit`, `stores/memory`, `stores/sql` have **zero npm
  dependencies** and no platform globals beyond ES2023 + Web APIs. The app's CI
  bundles `core` and `client` without installing tce's packages.
- Relative imports carry their extension (`./x.ts`). Node runs the sources
  directly (type stripping), so only erasable TypeScript: no enums, no
  namespaces, no parameter properties, `import type` for types.
- No reverse edges, no cycles. Tests may additionally import `testkit` and the
  local stores.
- One edge out of tce: `hosts/cloudflare` mounts the accounts routes through
  `accounts/hosts/cloudflare/index.ts` (optional Google sign-in; its own
  package, database and rules in `accounts/AGENTS.md`). Nothing else in tce
  imports accounts, and no tce table ever holds an account ID.

## 3. Code law

- Expected failures return `TceResult` with an `ErrorCode` (`core/result.ts`).
  Never throw for bad input, size caps, missing rows or an unavailable store. A
  throw that escapes an op is a bug; hosts turn it into `internal` and log it.
- Inject `Clock`, `IdGenerator`, `HashPort`, `FetchPort`. Core and
  client never call `Date.now()`, `Math.random()`, `crypto` or `fetch` directly.
- No global mutable state. A host builds one context per request.
- Validation lives in the op's `parse()`: check shape, then truncate fields to
  `LIMITS`; reject only over body/list caps or broken shapes.
- Every public function and type has a one-line doc comment; non-obvious
  decisions get a `why` comment.

## 4. Adding things

- **Operation**: one file in `core/ops/`, one line in `core/ops/registry.ts`,
  fixtures and tests. Hosts and stores do not change.
- **Event name**: `core/schema/events.ts` plus `docs/telemetry.md`.
- **Column or table**: a new `stores/sql/migrations/000N_*.sql` (never edit a
  shipped one; additive only, so the live Worker keeps working), the row type
  in `core/schema/rows.ts`, every store, the contract test, `docs/telemetry.md`.
  The build cannot migrate D1 (its token has no D1 permission): we apply
  the migration with `cf d1 migrations apply` before pushing
  (`README.md`, Deploys).
- **Store**: `stores/<name>/` implementing `core/store.ts`, passing
  `testkit`'s `StoreContract`; add it to LAW.
- **Host**: `hosts/<name>/` mapping its runtime onto `core/ops/registry.ts`;
  add it to LAW.

## 5. Privacy law

Never collected or stored: prompts, session content, file paths, env names,
provider keys, the bridge token, screenshots, package names of apps the agent
controlled, raw IP addresses, raw ANDROID_ID or Widevine ids. Hosts pass only
`Edge` (country, region, ASN, colo, request id) to ops. Identity hashes are made
on the device with the peppers in `core/schema/limits.ts`. A new field is added
to `docs/telemetry.md` in the same change, or it does not ship.

## 6. Cloudflare

The `phonecando` Worker is built and deployed by Cloudflare Workers Builds on
every push to `prod`, from `hosts/cloudflare/wrangler.jsonc`. There is no local
deploy step. Changing Cloudflare resources (D1, secrets, rate-limit
namespaces, build trigger) needs explicit approval for that exact
command. There is no cold storage yet, and retention deletion is switched off
(`RETENTION_ENABLED` "false"): all rows are kept until the backup exists, built
when the database nears its limit (`docs/planning/todo.md`, Backup). The
published docs still promise the retention ages; the limit check warns before
the oldest row reaches them.
