# Settled decisions

- **Cloudflare first, behind `Store` and host seams:** another platform is one `stores/` and one `hosts/` folder.
- **On by default, one switch off:** nothing is sent until the first-launch notice is answered.
- **Strong ids, hashed on the phone:** random `install_id`, peppered `device_id` and `hw_hash`; `drm_id` coded but off.
- **Device proof for ownership:** the server pins a verifier first-write-wins; a known `deviceId` can neither write nor delete.
- **Delete my data reaches every install of the phone;** a report pins the device so report-only phones can delete too.
- **Engine log only in user reports:** automatic telemetry sends only the exit code.
- **Retention coded but off and unscheduled:** we keep all data until the backup exists; the docs keep the promised ages and the limit check warns before they pass.
- **No cold storage yet:** a backup is built only when the database nears its limit.
- **`site_daily` rollup:** daily page-view and download totals kept forever; Analytics Engine keeps detail ~3 months.
- **Limit check on every build:** warns from 70%, CRITICAL from 90%, never blocks a build.
- **Abuse bounds on a free plan:** small caps, 100 reports/day, per-IP limits (IP never stored), a 450 MB ingest guard.
- **No analytics data in the repo;** GitHub's counters are pulled into D1 by a cron.
- **`/v1/dl` redirects; `latest.json` is not proxied,** so the updater never depends on the Worker.
- **Worker config lives in `tce/`;** `web/` stays a pure static build.
- **Migrations before the push:** the Workers Builds token has no D1 permission.
- **Truncate, don't reject;** paths and secrets are redacted again on the server; unknown event names are dropped.
- **Zero-dependency `core` and `client`, typed results, injected ports.**
- **Debug builds send nothing.**
