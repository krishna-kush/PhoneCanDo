# Accounts rules — read before touching `accounts/`

`accounts/` is optional Google sign-in for PhoneCanDo: the API under
`https://api.phonecando.app/v1/account/*`, its sessions, and the list of share
links and the settings a signed-in person keeps so a new phone shows them too. The published
schema and privacy terms are `docs/accounts.md`; change it in the same change
as any route, table or stored field. Checks: `pnpm -C accounts check`
(type-check per module + `scripts/check-deps.mjs`) and `pnpm -C accounts test`
(CI: `.github/workflows/accounts.yml`).

## 1. Boundary

`accounts/` owns: checking Google ID tokens, nonces, sessions, the
`phonecando-accounts` D1 schema (`stores/sql/migrations/`), the routes and
their tests. It never imports tce and tce never imports it, except the one
mount: the Worker (`tce/hosts/cloudflare/`) calls `accountsFetch` from
`hosts/cloudflare/index.ts`, its only public entry. The app talks to it over
HTTP (`phonecando-account` holds the session token natively); the site never
imports it.

## 2. Dependency law (`scripts/check-deps.mjs` is the source of truth)

```
core                       <- everything
runtime          -> core   (Web Crypto + fetch behind core's ports)
stores/memory    -> core
stores/sql       -> core
stores/d1        -> core, stores/sql
hosts/cloudflare -> core, runtime, stores/sql, stores/d1
testkit          -> core, runtime, stores/sql, stores/d1   (tests only)
```

- Zero npm runtime dependencies anywhere: the Worker bundles these files as
  they are. Only `testkit`, tests and `scripts` may import `node:*`.
- Node runs the sources directly (type stripping): erasable TypeScript only
  (no enums, namespaces or parameter properties), `import type` for types,
  relative imports with their extension.

## 3. Code law

- Expected failures (bad input, a bad token, no session, sign-in not set up)
  return a `Result` with an `ErrorCode` (`core/result.ts`); a store or
  Google's key set that fails throws, and the router answers `internal`.
- Core never calls `Date.now()`, `crypto` or `fetch`: `Clock`, `CryptoPort`
  and `KeySource` are injected (`core/ports.ts`).
- A route is one file in `core/ops/` and one line in `core/ops/registry.ts`.
- A store change passes `testkit/scenarios.ts` on every store (memory,
  node:sqlite, the D1 driver).

## 4. Privacy law

- Kept only for people who sign in: Google's account number (`sub`), the
  account's email, when it was made and last used; sessions as SHA-256 of
  the token; share codes with their times; the app's synced settings
  (small plain values, `docs/accounts.md` lists them). Never a name, a photo, the ID
  token, the token itself, an IP address or which app a link was shared to.
- Never joined with usage stats: no device ID, install ID or telemetry table
  here, and no account ID in tce.
- Logs carry the route, the status and why a request was refused, never a
  token, nonce, email or account number.
- Delete account (`POST /v1/account/delete`) removes the account, every
  session, the share list and the settings in one transaction.

## 5. Cloudflare

D1 database `phonecando-accounts` (binding `ACCOUNTS_DB`) and the
`GOOGLE_CLIENT_IDS` var live in the Worker's `wrangler.jsonc`. Creating the
database and applying a migration (`stores/sql/migrations/`, additive only,
never edit a shipped one) need explicit approval for that exact command, and
a migration is applied before the push that needs it (Workers Builds cannot
migrate D1).
