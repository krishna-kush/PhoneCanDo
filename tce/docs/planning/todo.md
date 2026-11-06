# Open work

Every Cloudflare write is stated as an exact command and waits for an explicit yes.

## App release

- [ ] On a release-signed build: first-launch notice, then device, install
  and session rows; reinstall keeps the device id; a forced JS and a native
  crash each arrive once; Send report and Delete my data work; the switch off
  sends nothing; boot time unchanged.

## Retention (switched off)

- [ ] Before the oldest data is 90 days old, turn deletion on (schedule the
  retention op in `core/ops/registry.ts` and the Worker crons, set
  `RETENTION_ENABLED` to `"true"`; steps in `../../README.md`, Retention), or
  change `docs/telemetry.md` and the privacy page. The limit check warns 14
  days ahead.

## Optional and deferred

- [ ] Worker secret `GITHUB_STATS_PAT` for repo traffic counters.
- [ ] Repo secret `CLOUDFLARE_ANALYTICS_TOKEN` (read-only: Account Analytics,
  D1) and variable `CLOUDFLARE_ACCOUNT_ID`, so the capacity check adds daily
  D1 rows and Worker requests.
- [ ] Node host: a rate limiter in front before exposing it, and a cron timer
  (it runs no crons today).
- [ ] `tce/` in `security.yml`'s pnpm audit; `tce-ok` required on `prod`.
- [ ] Decide `OPENCODE_DISABLE_MODELS_FETCH` (the engine re-downloads a 2 MB
  model catalog every 5 minutes).
- [ ] Anti-abuse hardening, deferred for now: `workers.dev` off, a zone
  rate rule, a daily ingest budget, key attestation.
- [ ] Play Data safety form before any Play release.

## Backup (when near the limit)

Start at the first 70% storage warning (90% pauses ingest). Carry over:
encrypt in the Worker with our public key (rows carry device ids); a D1
outbox drained by an authenticated job into our own storage; delete from D1
only after our side confirms; byte-capped chunks for the
~10 ms CPU limit. Before it ships, publish what Delete my data does to backed-up
rows and how long backups are kept.
