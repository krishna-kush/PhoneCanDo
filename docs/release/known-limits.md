# Known limits

These are not scheduled work unless they are also listed in
`docs/planning/automation.md` or `pce/docs/planning/todo.md`. PCE-internal limits are in
`pce/docs/release/known-limits.md`.

## Automation API

- `mobile_screenshot` is not registered. Use
  `mobile_observe({screenshot: true})`; the explicit `Action.Screenshot` has
  no artifact return path and every backend rejects it.
- `mobile_execute`, `mobile_flow`, `mobile_doctor` and flow saving are target
  surface. The current build runs a named flow with
  `mobile_pack {"action":"run","id":"<pack>","flow":"<flow>","params":{...}}`.
- Pack crypto is gated below API 33; no provider is bundled. The above gate is
  code-inspected, not device-tested.
- Bundled baseline packs and app-start refresh throttling are not implemented;
  pack updates are manual (`mobile_pack refresh`).
- Android 11+ package visibility can hide an installed app from
  `getLaunchIntentForPackage` and from the bridge shell's `pm list packages`.
  `mobile_launch` may return `NOT_FOUND`; fall back to launcher UI search.
- `mobile_info.activity` comes from the last accessibility window-state event;
  it is null until the service sees one and can lag a dialog/window transition.
  `mobile_wait` polls; it compares `eventSeq` when present and falls back to
  the node signature. The staged eventSeq comparison lands with the next APK.
- `mobile_home` backgrounds PhoneCanDo. With phone control enabled the host
  vetoes the JS idle shutdown; with phone control off the idle shutdown still
  applies.
- Shizuku is optional WIP and not in the v1 router. The granted path and
  `newProcess` → `UserService` migration await work.
- The vision backend is not implemented.
- Secure windows work for the tree only; screenshots are blocked.
- High-risk actions require confirmation; no raw shell action is exposed.
- Device coverage is currently Android 16 / API 36.

## Host and builds

- Lite/play builds have no accessibility host, PCE, packs or automation UI.
  They register only the six basic tools. Lite still self-updates from GitHub;
  Play updates through Play and has no install-packages permission.
- Play Protect hard-blocks the full APK when it comes from a browser,
  messaging app or file manager (accessibility service declared; nearly all
  markets). Lite is the download; it installs full in place and that install
  is allowed. Full stays directly installable only via `adb install`.
- Android 13+ restricted settings: after an install from a file the
  accessibility toggle is refused until App info → ⋮ → Allow restricted
  settings, and that menu item only appears after Android has shown its
  "Restricted setting" notice. The app cannot read the lock (the app op is
  read-protected by the framework), open the ⋮ menu or clear the lock, so a
  constant (`RESTRICTED_FLOW`) runs a three-step guide with self-tracked
  progress: Android's "Restricted setting" message (shown in place on
  Android 14+, through the Accessibility list on 13), App info, the switch.
  Only the switch turning on is observable.
  Details and the on-device checks: `research/restricted-settings.md`.
- opencode 2.0.26 has no `ctx.permission.assert`, and Code Mode's `execute`
  bypasses top-level permission rules for plugin tools. The app-side biometric
  master switch is the gate until opencode is bumped.
- The debug build uses a test-only pack public key; a release must set
  `phonecando_pack_public_key` and keep the private key offline.
- The bridge bearer is per agent (made with the agent, kept for its
  lifetime) and loopback-only. `open`/`share` work only while the app is
  foreground; clipboard reads report `available:false` to background apps
  (API 29+).
- With several agents running, one drives the screen at a time: the others
  get `control_busy` until the holder has been idle for 30 s, and the phone
  control switch is one switch for every agent.
- The bridge shell runs as the PhoneCanDo UID, so its package listing is
  filtered; it is not proof an app is missing.

## opencode payload and platform

- Android 10 (API 29) or newer: the payload is built for API 29, so the app's
  minSdk is 29 (`app/plugins/withMinSdk.js`; CI's emulator floor leg runs it).
- opencode is pinned to the self-built `v2.0.26-android-phonecando.1`
  payload. Bumping it requires re-checking the embedded web UI theme override
  (`--v2-*` variables and `opencode-color-scheme`); a rename fails silently.
- Boot receiver is not implemented.
- The engine's foreground service is type `specialUse`, which Android gives
  no time limit (`dataSync`, which we used before, stops after 6 hours in
  any 24 in the background on Android 15+). A Play release needs Play's
  review of that type; what we do if Play refuses it is in
  `docs/planning/todo.md`.
- Battery-exemption prompting is not implemented, and a dead engine is not
  restarted by itself: the next start (its chat or terminal opening, or the
  app coming to the foreground for the active agent) launches it again.
- Any number of engines and local model servers may run at once; when the
  phone nears its memory peak the runner warns and then stops the least
  recently used agent itself (`app/docs/modules/runner.md` → Memory guard).
  Optional caps in Settings limit both: a start past the agents' cap stops
  the least recently used engine idle for a minute, and is refused
  (`too_many_running`) when none has; a model past the models' cap is
  refused (`too_many_models`). An agent's terminal and web UI share its
  engine; different agents are separate engines in separate images.
- iOS cannot run the local container; it is remote-only (later phase).

## Linux images

- Play ships no Linux: its agents run commands with Android's shell.
- proot is not a VM: there is one kernel (Android's), no systemd or other
  init, and `/proc` files Android hides from apps are static stand-ins.
- An Own env needs a linux/arm64 image. Docker Hub allows about ten
  anonymous pulls per hour per IP; official images then come from
  `public.ecr.aws` or `mirror.gcr.io`, other images have no mirror.
- `lre/images/default/lock.json` locks no image yet, so no build ships a
  Default image; a release needs `--without-linux` until one is locked.
- Reset replaces an image's system and keeps `home/`; packages installed by
  hand are offered for reinstall, not reinstalled by themselves.
- Unix socket paths are capped at 108 bytes; image setup flags an image
  whose `home/` or `tmp/` leaves too little room for socket names.
- The native payload is large (hundreds of MB) and ships out of git.
