# Accounts

Signing in is **optional**. PhoneCanDo works the same without it; usage
stats ([telemetry.md](telemetry.md)) never need it. You sign in with Google
from Settings → Account, and today it does two things: the share links you
send (Settings → Tell a friend) stay with you, so a new phone or a reinstall
shows them and what they did once you sign in again; and a few of your
settings (listed under [Settings](#settings)) follow you to every phone you
sign in on. More is planned on the same account, each optional too; this page
changes before any of it ships.

This page is the published schema: every route, everything the server keeps
for a signed-in person, and for how long. The code is the source of truth and
this page changes with it in the same commit (`accounts/AGENTS.md`): routes
in `accounts/core/ops/`, numbers in `accounts/core/limits.ts`, tables in
`accounts/stores/sql/migrations/`.

## In short

- **Only if you sign in.** Nothing on this page exists for anyone who does not.
- **What we keep:** your Google account number, your Google email, when you
  first signed in and last used it, a hash of each phone's session, the
  codes of your share links with when you made them, and the settings below
  with when you last changed them.
- **Never kept:** your name, your photo, the token Google gives the app, your
  password (Google never shares it), your IP address, which app you shared a
  link through, and anything from your agents.
- **Never linked to usage stats.** The account holds no device or install ID,
  and the usage stats hold no account.
- **Delete account** (Settings → Account) deletes all of it at once. **Sign
  out** ends only that phone's session.

## Where it goes

| | |
|---|---|
| Endpoint | `https://api.phonecando.app/v1/account/*`, the same Worker as the usage stats and the site |
| Code | `accounts/` (`hosts/cloudflare/` is the Worker's mount) |
| Storage | Our Cloudflare account: D1 database `phonecando-accounts`, separate from the usage stats' `phonecando-stats`. No archive or backup copy beyond D1's own 7-day Time Travel. Cloudflare processes it on our behalf. |
| Not stored | Nothing is sold or shared. Google learns that you signed in to PhoneCanDo (it shows the app on your Google account's third-party connections). |

## How sign-in works

1. The app asks `POST /v1/account/nonce` for a one-use random value.
2. Android's own Google sheet (Credential Manager) asks you to pick an
   account. Google gives the app an ID token, signed by Google, that names
   your account and carries the nonce.
3. The app sends the token and nonce to `POST /v1/account/signin`. The server
   checks the token against Google's published keys
   (`https://www.googleapis.com/oauth2/v3/certs`): signed by Google (RS256),
   issued by `accounts.google.com`, for our app's client ID, not expired (one
   minute of clock leeway), with a verified email, carrying a nonce we issued
   in the last 10 minutes and not used before. Any check failing refuses the
   sign-in.
4. The server answers a session token (32 random bytes). The phone keeps it
   encrypted with a key in the Android Keystore; the server keeps only its
   SHA-256, so a copy of the database signs nobody in. The name and photo
   Google shows are kept on the phone only, for Settings → Account.

Google's sign-in needs Google Play services on the phone; without them the
Account page says so and nothing is sent.

## What is stored

| Table | Field | What | Kept |
|---|---|---|---|
| `accounts` | `id` | our own random ID (UUID) for the account | until Delete account |
| | `google_sub` | Google's number for your account (the ID token's `sub`; Google gives every app the same number for it) | until Delete account |
| | `email` | your Google account's email, refreshed on every sign-in | until Delete account |
| | `created`, `last_seen` | first sign-in; last sign-in or use (written at most once a day) | until Delete account |
| `sessions` | `token_hash` | SHA-256 of one phone's session token | until Sign out, Delete account, or 180 days without use |
| | `account_id`, `created`, `last_used` | whose session, when made, last used (written at most once a day) | same |
| `nonces` | `nonce`, `expires` | a sign-in's one-use value | 10 minutes, or until used |
| `account_shares` | `code`, `created` | a share link's 8-character code and when the phone made it; at most 500 per account, newest kept | until Delete account |
| `account_settings` | `key`, `value`, `at` | one of the settings below, its value, and when a phone last changed it (that phone's clock); at most 32 per account, the most recently changed kept | until Delete account |

Which app a link went through stays on the phone that sent it. A link's open,
download and install counts belong to the usage stats ([telemetry.md](telemetry.md),
Share links) and are read by code; the account only lists your codes.

## Settings

What follows you between phones: the theme (`themeMode`), whether the
terminal's extra keys stay up (`extraKeysSticky`), the starter build's "stop
offering the full build" (`updatePromptMuted`), and the caps on agents and
local models running at once (`maxAgents`, `maxModels`). A phone sends a
setting a moment after you change it and reads the account's when you sign in
and when the app comes back to the front. For each setting the later change
wins; on a tie the account's stays.

Never synced: the usage-stats switch (each phone's own consent), Phone
control's lock mode (each phone's own safety), API keys and tokens, your
agents and their machines.

## Routes

Every answer is JSON and never cached. Errors are `{ "error": code }`.

| Route | Body | Answer | Limit |
|---|---|---|---|
| `POST /v1/account/nonce` | none | `{ "nonce" }` | public |
| `POST /v1/account/signin` | `{ "idToken", "nonce" }` (≤ 8 KB) | `{ "token", "account": { "email", "createdAt" } }` | rare |
| `GET /v1/account` | none | `{ "account": { "email", "createdAt" } }` | public |
| `PUT /v1/account/shares` | `{ "links": [{ "code", "created" }] }` (≤ 500 links, ≤ 32 KB) | `{ "links": [...] }`: what the account had joined with what was sent (a code keeps its earliest time), newest first, at most 500 | public |
| `GET /v1/account/settings` | none | `{ "settings": { "<key>": { "value", "at" } } }` | public |
| `PUT /v1/account/settings` | `{ "settings": { "<key>": { "value", "at" } } }` (≤ 32 settings, ≤ 8 KB; a key is a short camelCase name, a value is text of ≤ 200 chars, a number, true, false or null) | the account's whole set after taking each sent setting that is newer | public |
| `POST /v1/account/signout` | none | `{ "ok": true }` | public |
| `POST /v1/account/delete` | none | `{ "deleted": true }` | rare |

Every route but nonce and signin needs `Authorization: Bearer <session token>`.

| Error | Status | When |
|---|---|---|
| `bad_request` | 400 | a body of the wrong shape, over its cap, or not JSON |
| `bad_token` | 401 | the Google token or the nonce did not check out |
| `signed_out` | 401 | no session token, an unknown one, or one unused for 180 days |
| `rate_limited` | 429 | over the limit (`Retry-After: 60`) |
| `not_found` | 404 | not a route |
| `not_configured` | 503 | sign-in is not set up on this server (nonce and signin) |
| `internal` | 500 | our bug or a database failure; logged with the request id |

**Abuse limits.** The Worker rate-limits these routes per client with the
same per-minute limiters as the usage stats ([telemetry.md](telemetry.md),
Abuse limits): sign-in and Delete account with the `rare` one, the rest with
the `public` one. The client's IP address keys the limiter and nothing else;
it never reaches these routes and is never stored.

## Delete account

`POST /v1/account/delete` with the phone's session deletes the account row,
every phone's session, the share-link list and the settings in one transaction. Signing in
again later starts a new, empty account. Not reached: D1's 7-day Time Travel
and the 3-day Workers Logs, which hold no email or account number (the log
lines carry the route, the status and why a request was refused). Usage stats
are not touched; Settings → Privacy → Delete my data removes those.

## Logs

A request the routes refuse or fail writes one log line to Cloudflare Workers
Logs (3 days): the route, the error code, the reason (e.g. "expired") and the
request id. Never a token, nonce, email or account number.
