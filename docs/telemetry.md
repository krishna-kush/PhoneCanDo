# Telemetry

PhoneCanDo sends anonymous usage statistics to its own server. This page is
the published schema: every field the app and the site send, what the server
adds, where it is kept and for how long, and every other network call the app
makes. The plain-language version is the site's privacy note
(`web/src/components/privacy/`, one file per section; `/privacy`).

The code is the source of truth and this page changes with it in the same
commit (`tce/AGENTS.md` §5): wire shapes in `tce/core/schema/wire.ts`, size
caps in `tce/core/schema/limits.ts`, event names in
`tce/core/schema/events.ts`, tables in `tce/core/schema/rows.ts` and
`tce/stores/sql/migrations/`, the native snapshot in
`app/modules/phonecando-runner/src/telemetry.types.ts`.

## In short

- **On by default** in release builds, from the first launch. There is no
  prompt: Settings → Privacy shows it, and this page and the site's privacy
  page describe it.
- **One switch** turns it off: Settings → Privacy. Off clears the unsent queue
  and nothing more is sent.
- **Delete my data** (Settings → Privacy) deletes every row the server holds
  for the phone, across every install on it (also after a reinstall or Reset
  anonymous ID), then turns sharing off and makes a new install ID.
- **Reset anonymous ID** makes a new install ID and drops the unsent queue.
  It does not unlink past data from this phone (the device ID stays the same);
  Delete my data is what removes it.
- **Send report** sends one report you write, with recent events and the
  redacted engine log tail. Only when you tap it; the log tail is never sent
  any other way.
- **Debug builds send nothing** (`__DEV__`; they are separate packages,
  `com.phonecando.app.<channel>.dev`). They queue locally, and only the
  developer-only switch "Send to local dev host" sends that queue, to
  `127.0.0.1:8787` (`pnpm -C tce dev`) and nowhere else.
- **Never sent:** prompts, chats, files, keys, the screen, which apps the agent
  used. Full list under [Never collected](#never-collected).

What it answers: how many installs and active phones there are, on which
devices and Android versions, whether setup and updates work, and which
crashes and engine failures to fix first.

## Where it goes

| | |
|---|---|
| Endpoint | `https://api.phonecando.app/v1/*` (the Worker that also serves the site at `phonecando.app`; the API answers only on its own host) |
| Code | `tce/` (Telemetry Collection Engine); Cloudflare host in `tce/hosts/cloudflare/` |
| Storage | Our Cloudflare account: D1 database `phonecando-stats` (the app's rows and the `site_daily` traffic totals) and Analytics Engine datasets `phonecando_pageviews` and `phonecando_downloads`. There is no archive and no backup copy beyond D1's own 7-day Time Travel. Cloudflare processes it on our behalf. |
| Not stored | Nothing analytics-related is written to the GitHub repo. Nothing is sold or shared. |

| Route | Body cap | Sent by |
|---|---|---|
| `POST /v1/batch` | 32 KB (≤ 10 sessions, 200 events, 20 errors) | the app, while sharing is on |
| `POST /v1/report` | 16 KB (≤ 50 events) | the app, when you tap Send report |
| `POST /v1/forget` | 2 KB | the app, when you tap Delete my data |
| `POST /v1/hit` | 2 KB | the site, once per page load |
| `GET /v1/dl/lite`, `GET /v1/dl/full` | none | the site's download buttons and QR code |
| `GET /v1/health` | none | the capacity check on every build ([Capacity](#capacity-get-v1health)); public |

The app queues events locally (at most 500; the oldest drop first) and sends
them in batches: about 10 seconds after launch, every 15 minutes while it is
in the foreground, and when it goes to the background. A send that fails is
retried later with backoff; nothing blocks the app. While the phone's clock
reads a year outside 2000–2200, nothing is sent until it is fixed.

**Abuse limits.** The endpoints are public and need no login, so the Worker
rate-limits each route per client (batch 6, report and delete 3, page views,
downloads and health 30 per minute, per Cloudflare location). The limiter is
keyed on the connection's IP address, held only in Cloudflare's rate limiter
for that minute; it is never logged, never passed to the telemetry code and
never stored. Over the limit, the app is told to retry later; a page view or a
download is simply not counted. At most 100 reports are accepted per day
across all phones. If the database nears its size limit (90% of the free
plan's 500 MB), new data is refused (the app retries later) and page views and
downloads are not added to `site_daily`, while Delete my data keeps working.

## Retention

| Data | Kept |
|---|---|
| `events` | 90 days, then deleted by the retention cron (every 15 minutes, `*/15 * * * *`) |
| `errors` | 180 days, then deleted the same way |
| `reports` | 90 days, then deleted the same way |
| `devices`, `installs`, `sessions` | until Delete my data |
| `github_assets_daily`, `github_repo_daily` | kept (aggregate counters, no people) |
| `site_daily` (daily page view and download totals) | kept (counts per day, path or channel, and country; no people) |
| Analytics Engine (site views and downloads in detail) | about 3 months (Cloudflare's limit) |
| D1 point-in-time backups (Time Travel) | 7 days on the free plan (30 on a paid plan): a deleted row is fully gone after that |
| Cloudflare Workers Logs (only the Worker's own log lines: operation, status, error code, request id; per-request invocation logs, which would hold headers and the IP, are turned off) | 3 days (7 on a paid plan); for debugging, not copied anywhere |

**There is no archive, cold storage or backup copy** beyond D1's 7-day Time
Travel. The retention cron deletes expired rows outright: reports first in
every run, then at most 250 of the oldest expired rows per table per run (a
free Worker gets about 10 ms of CPU), so 96 runs a day can delete up to 24,000
rows per table, more than a normal day adds. After the Time Travel window a
deleted row is gone.

A backup is planned for when the database nears its free-plan limit, not
before. A capacity check runs on every build (`tce/scripts/check-limits.mjs`,
`./manage limits`): it reads [`GET /v1/health`](#capacity-get-v1health)
and warns from 70% of the 500 MB (CRITICAL from 90%, where the storage guard
starts refusing new data). If a backup is added, this page says what it holds
and for how long before it ships.

`site_daily` and the GitHub counters hold no device ID, so they keep nothing
of a phone that Delete my data could remove.

## Identity

The server never sees a raw hardware ID; it only checks each ID's shape. An
install is keyed on the pair (`install_id`, `device_id`), so an Auto Backup
restore on another phone counts as a new install.

| Field | What | Made from | Survives | Changes on |
|---|---|---|---|---|
| `installId` | lowercase UUID v4 | random, on first launch | app updates, lite → full | uninstall, Clear data, Reset anonymous ID (which also clears the unsent queue), Delete my data |
| `deviceId` | 64 hex | SHA-256 of `phonecando.device.v1:` + `ANDROID_ID`, on the phone | reinstall, Clear data | factory reset; `ANDROID_ID` is per device, user and signing key |
| `deviceVerifier` | 64 hex | SHA-256 of the device proof, where the proof is SHA-256 of `phonecando.forget.v1:` + `ANDROID_ID`, on the phone | like `deviceId` | like `deviceId` |
| `hwHash` | 64 hex | SHA-256 of `phonecando.hw.v1:` + manufacturer, model, design and product name, build fingerprint and total RAM, on the phone | reinstall, factory reset | a system update (new build fingerprint); identical phones on the same build share it |
| `drmId` | 64 hex | SHA-256 of `phonecando.drm.v1:` + the Widevine device ID | | **off**: the Kotlin flag `TELEMETRY_DRM_ID_ENABLED` is false, so it is never sent |
| `sessionId` | UUID | random, per app process start | that run | every start |
| `seq` | integer | counter per session, shared by events and errors | | |

**Why `deviceVerifier`.** The server keeps the first verifier it sees for a
`deviceId` and refuses any batch that carries another one, and Delete my data
must present the proof itself (sent only then). The proof and the `deviceId`
are different hashes of `ANDROID_ID`, so knowing a `deviceId` is not enough to
write data as that phone or to delete its data. A session ID that already
belongs to another phone is refused too, and so is a report sent under a
phone's ID with the wrong verifier. A session's build (version and channel)
is kept from its first write and never re-attributed.

## Batch (`POST /v1/batch`)

Every batch carries `schema: 1`, a `batchId` (UUID, tracing only), `sentAt`
(the phone's clock, used to correct clock skew), the identity above, and:

### Device (`devices` table, one row per `deviceId`)

| Field | Meaning |
|---|---|
| `manufacturer`, `model` | e.g. `Google`, `Pixel 8` (≤ 64 chars) |
| `sdkInt` | Android API level, e.g. `35` |
| `abi` | CPU ABI, e.g. `arm64-v8a` |
| `ramGb` | total RAM, whole GB |
| `locale` | BCP 47, e.g. `en-IN` |
| `installSource` | the installer's package name exactly as Android reports it (a browser, a file manager, PhoneCanDo's updater, Play; an adb install may report a shell or installer package); null when unknown. Stored on the install row. |
| `tester` | one of our own test phones; excluded from every count |

### App (stored on the install and session rows)

| Field | Meaning |
|---|---|
| `version`, `versionCode` | e.g. `0.1.2`, `10` |
| `channel` | `full`, `lite` or `play` |

The install row keeps `first_version`, `last_version`, `last_version_code`,
`first_seen` and `last_seen`.

### Sessions (`sessions` table, one row per app run, merged as it progresses)

| Field | Meaning |
|---|---|
| `sessionId`, `startedAt`, `endedAt` | the run and when it started and ended |
| `version`, `versionCode`, `channel` | the build this run used, stamped when it started (so a run flushed after an update is not credited to the new build) |
| `bootMs` | ms from the engine start request to its first healthy answer |
| `engineOk` | no failed start and no unexpected exit so far in this run |
| `engineExitCode` | exit code of the last unexpected engine exit |
| `engineStderrTail` | in the schema but **never sent automatically**: raw engine output can contain prompt text, so the app attaches the redacted tail only to a report you send |
| `lowMemoryTrims` | times Android asked the app to free memory (running low or worse); always 0 on Android 14+, which no longer sends those levels |
| `batteryOptIgnored` | the app is exempt from battery optimisation |
| `fgServiceOk` | the engines' foreground service is running: at least one agent's engine is starting, running or stopping |
| `a11yOn` | the accessibility service is connected (full builds) |
| `counters` | running totals for this run, ≤ 64 keys of ≤ 64 chars from `[A-Za-z0-9_.:-]`, e.g. `{"tool.pce_act": 4, "session.create": 1}`: phone-control bridge calls per route (`tool.notify`, `tool.pce_act`, `tool.pce_observe`, ...; several `mobile_*` tools share one route), engine sessions created, and engine `engine.starts`, `engine.startFails`, `engine.died`, `engine.portSquats`. Names and counts only, never arguments |

### Events (`events` table)

Each event has `sessionId`, `seq`, `ts` (phone clock), `name` and optional
`props`: at most 16 keys of ≤ 40 chars, values a number, a boolean or a string
of ≤ 200 chars (paths replaced by `<path>`), ≤ 512 bytes as JSON. The props
the app sends today are `version`, `lite`, `manual`, `stage`, `from`, `to` and
`channel` on update events: short strings, numbers and booleans, never
content, e.g. `{"version": "0.1.3", "stage": "download"}`.
The server drops names that are not in this list:

| Name | When |
|---|---|
| `update.check.none`, `update.check.newer`, `update.check.failed` | result of an update check |
| `update.offered` | the update dialog offered a newer build |
| `update.accepted`, `update.cancelled` | you started or cancelled it |
| `update.downloaded`, `update.failed` | how the download and hand-off went |
| `update.installed` | first launch on a higher `versionCode` (so it also counts Play and adb updates), with `from` and `to` |
| `a11y.step.<n>.reached`, `a11y.step.<n>.done` | step `n` (0–99) of the accessibility setup guide shown / finished |
| `control.unlock` | phone control was unlocked with biometrics/PIN (Settings or the in-chat prompt) |
| `chat.open`, `terminal.open` | the tab was opened |
| `env.add` | an Own env (a Linux base the user picked from a container registry) finished downloading; the image name and tag are not sent |
| `report.sent` | you used Send report |

Also in the server's vocabulary but **not sent by the app today**:
`a11y.restricted_seen`, `forget.requested`, `provider.<name>` (no read-only
source for the provider name), and `engine.start.ok`, `engine.start.fail`,
`engine.port_squat`, `engine.died`, `tool.<name>` — the engine and tool
figures travel as session `counters` instead (see above).

### Errors (`errors` table)

| Field | Meaning |
|---|---|
| `errorId` | UUID made on the phone, so a resend is not counted twice |
| `kind` | `js` (a non-fatal app JavaScript error; fatal ones surface as `native`), `native` (an uncaught JVM crash, recorded on the phone without network and sent on the next run), `engine` (an unexpected engine exit: class and message `exit <code>` only, timed when it happened) |
| `className` | e.g. `TypeError`, `java.lang.IllegalStateException` (≤ 120) |
| `message` | ≤ 200 chars |
| `frames` | top 5 stack frames, ≤ 200 chars each, paths replaced by `<path>` |
| `sessionId`, `seq`, `ts`, `version` | when and in which run and version |

A native crash is recorded on the phone as id, time, exception class,
message (paths redacted, ≤ 200 chars), top 5 frames, thread name and app
version, and sent as one `native` error with the fields above (the thread
name stays on the phone).

The server adds `error_key` = SHA-256 of kind, class, top frame and version,
so one bug on many phones is one key.

### Added and checked by the server

- `received` (server time). Event and error times are stored twice: raw as
  `ts_client`, and as `ts` corrected by the batch's clock skew
  (`received - sentAt`); session start and end are skew-corrected too.
- From Cloudflare's edge: `country` (ISO code) and `asn` (the network's
  number, e.g. a mobile carrier). The IP address is never stored in these
  tables.
- Unknown event names are dropped, not stored (the response counts them).
- Paths and secrets are redacted on the phone and again on the server. A
  whole path becomes `<path>` (a frame's `:line:col` is kept): `/data/user/N`,
  `/data/user_de/N`, `/data/data`, `/data/app`, `/data/media/N`, `/storage/…` (internal and
  SD cards), `/sdcard`, `/mnt/…`, `~/…`, `file://`, `content://` and their
  URL-encoded forms. Bearer/Basic credentials, common API key and token
  formats, and `api_key`/`token`/`secret`/`password` JSON values become
  `<secret>`. This applies to error messages, frames, report notes and report
  log tails. A path that starts right after a quote runs to the closing
  quote, and a path in a Java file error runs to its `: open failed:` or
  `(No such file or directory)` suffix, so those paths are removed whole even
  with spaces. An unquoted path with spaces and no such ending can still leave
  the words after the first space (there is no way to tell where it ends).
- Every field is cut to the caps above; only an oversized body or list is
  rejected.

## Send report (`POST /v1/report`, `reports` table)

Only when you tap it, only while sharing is on: `reportId`, the identity,
device and app fields above, the current `sessionId`, your note (≤ 500 chars),
the last ≤ 50 events, and the engine log tail: the ≤ 2 KB tail from the last
unexpected engine exit (the end of that agent's engine log, `logs/engine.log`
in its image), with whole paths and secrets redacted on the phone and
again on the server (the schema allows up to 4 KB). Kept 90 days, or until
Delete my data. A report also records the phone's device row and verifier
(the same rules as a batch), so Delete my data can find and remove it even
if the phone never sent a batch.

## Delete my data (`POST /v1/forget`)

Sends `deviceId` and the device proof (see [Identity](#identity)); it is the
only request that carries the proof. If the proof matches the verifier the
server pinned for that phone, the server deletes every row with that
`device_id` (all installs on the phone, whatever install ID made them) from
`devices`, `installs`, `sessions`, `events`, `errors` and `reports`, and
returns the counts. The app first stops sending and waits for any send in
flight, so nothing lands after the delete. It then clears its queue, turns
sharing off and makes a new install ID. If the server holds nothing for the
phone, the app says so instead of claiming a deletion. Not reached: D1's
7-day backups and the 3-day Workers Logs (see [Retention](#retention)); there
is no other copy.

## Site page views (`POST /v1/hit`, Analytics Engine `phonecando_pageviews`, `site_daily`)

The site's one inline script sends `path` (no query string) and `ref`
(`document.referrer`) once per page load. Stored in Analytics Engine for about
3 months: path (≤ 200 chars), the referrer's host only (≤ 100; none for links
within the site), country, and a user-agent class (`bot`, `android`, `ios`,
`desktop`, `other`). Also counted, for good, in the D1 table `site_daily`: +1
on the row (UTC day, `view`, path, country; country empty when unknown), and
nothing else (no referrer, no user-agent class, so bots are in these totals).
No cookie, no ID, nothing stored in the browser, no IP. Not sent under Do Not
Track or Global Privacy Control, from a page not served over https, or from
localhost (so local and CI runs never count). A page view over the rate limit
is not counted anywhere.

## Downloads (`GET /v1/dl/<channel>`, Analytics Engine `phonecando_downloads`, `site_daily`)

The site's buttons and QR code go through `https://api.phonecando.app/v1/dl/lite`
and `.../v1/dl/full`, which
redirect to that version's APK on GitHub. Stored in Analytics Engine for about
3 months: channel, version, country, the Android major version from the user
agent, the referrer's host and the user-agent class. Also counted, for good,
in `site_daily`: +1 on the row (UTC day, `download`, channel, country). No ID,
no IP. A `HEAD` request or one over the rate limit still redirects but is not
counted. Only a person's browser counts in `site_daily`: a navigation (the
`Sec-Fetch-Mode: navigate` header browsers send when someone clicks a link or
opens a URL, a scanned QR code included; Chrome 76+, Firefox 90+, Safari
16.4+) from a client that does not name itself a bot. Anything else (curl,
scripts, crawlers, and browsers older than those) still redirects and is kept
in Analytics Engine with the user-agent class `bot`. The computer commands
link GitHub directly. `./manage data` shows both.

## Capacity (`GET /v1/health`)

Public, no login, no body. Apart from the rate limiter's key (see Abuse
limits above) it reads nothing from the request, and it answers only figures
about the database, never about a phone or a person: `serverTime`, `db.bytes`
(the database's current size; null when the Worker cannot tell),
`db.limitBytes`, `db.warnRatio` and `db.guardRatio` (500 MB, 0.7 and 0.9:
`CAPACITY` in `tce/core/schema/limits.ts`), and `ingestPaused` (the storage
guard is refusing new data right now). Never cached, rate-limited like page
views, and nothing is stored when it is called beyond the Worker's usual log
line.

The capacity check (`tce/scripts/check-limits.mjs`) reads it on every build:
`./manage build` and `./manage release` run it first, the TCE workflow runs it
on pushes to `prod` and nightly, and the Worker's build runs it too. With an
optional read-only Cloudflare token it also compares today's D1 rows read and
written and the Worker's requests with the free plan. It warns from 70% of a
limit and says CRITICAL from 90%; it never blocks a build.

## GitHub counters (`github_assets_daily`, `github_repo_daily`)

A daily cron (`17 3 * * *`) copies GitHub's own aggregate numbers: each
release asset's download count, stars, forks and watchers, and, only when a
token is configured, the repo's views, clones and referrers. `latest.json`
downloads are the app's update checks, so they approximate launches.
`./manage stats` prints the release counts.

## Never collected

Prompts, chat and session content, model output, files and file paths,
environment variable names and values, provider API keys, the bridge token,
screenshots and screen content, names of apps the agent controlled, contacts,
messages and notifications, raw IP addresses, the raw `ANDROID_ID` or Widevine
ID, precise location, advertising IDs, names, email addresses and phone
numbers.

## Every network call the app makes

| Call | When | Carries |
|---|---|---|
| `GET https://github.com/krishna-kush/PhoneCanDo/releases/latest/download/latest.json` | on launch (full; lite unless muted in Settings → Update) and from Settings → Update; never in play builds | nothing beyond a normal request |
| The release APK from `github.com` (redirected to GitHub's file host) | only after you tap install (an update, or lite → full) | nothing beyond a normal request |
| `https://api.phonecando.app/v1/*` | release builds, while sharing is on; report and delete only when you tap them | the fields on this page |
| `GET https://models.opencode.ai/api.json` (opencode's models.dev catalog) | by each running engine (opencode v2.0.26; up to three run at once, one per agent) when it starts, then again every 5 minutes while it runs: the whole catalog (over 2 MB) each time; `OPENCODE_DISABLE_MODELS_FETCH` is not set | a `User-Agent: opencode/<channel>/<version>/<name>` header |
| `https://hub.docker.com` (Docker Hub's catalog: the official OS list and an image's tags) | full and lite, only while you pick an Own env (Env → New env → Own) | the repository name and the version filter you type; a `User-Agent: phonecando-lre` header |
| The container registry of an Own env (Docker Hub's `registry-1.docker.io` and its token service, or the registry the image name gives), the storage it redirects downloads to and, for Docker Hub official images when Docker Hub refuses or fails, `public.ecr.aws` and `mirror.gcr.io` | full and lite, only when you add an Own env or retry its download | the image name and tag you picked; a `User-Agent: phonecando-lre` header |
| The model providers you configure | whenever the agent runs | your prompts and that provider's key, straight from the phone to the provider; PhoneCanDo's server is never in that path |
| Whatever you or the agent start | the agent's web fetch and web search tools, a `curl` or a package install in the terminal or an agent's image | what that command sends |

The engine's own auto-update and language-server downloads are off
(`OPENCODE_DISABLE_AUTOUPDATE`, `OPENCODE_DISABLE_LSP_DOWNLOAD`, set for every
engine in `app/modules/phonecando-runner/android/src/main/java/com/phonecando/runner/agents/oc/Launch.kt`).
The chat tab's web UI and the phone-control bridge talk to the engines over
`127.0.0.1` only. The Default env's image ships inside the APK, so a Default
machine is made without any network call.
