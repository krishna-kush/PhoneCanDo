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

- Play builds have no accessibility host, PCE, packs or automation UI. They
  register only the six basic tools.
- opencode 2.0.26 has no `ctx.permission.assert`, and Code Mode's `execute`
  bypasses top-level permission rules for plugin tools. The app-side biometric
  master switch is the gate until opencode is bumped.
- The debug build uses a test-only pack public key; a release must set
  `phonecando_pack_public_key` and keep the private key offline.
- The bridge bearer is install-stable and loopback-only. `open`/`share` work
  only while the app is foreground; clipboard reads report `available:false`
  to background apps (API 29+).
- The bridge shell runs as the PhoneCanDo UID, so its package listing is
  filtered; it is not proof an app is missing.

## opencode payload and platform

- opencode is pinned to the self-built `v2.0.26-android-phonecando.1`
  payload. Bumping it requires re-checking the embedded web UI theme override
  (`--v2-*` variables and `opencode-color-scheme`); a rename fails silently.
- Boot receiver is not implemented. Android 15+ forbids a dataSync foreground
  service from `BOOT_COMPLETED`.
- Battery-exemption prompting and health-check restart recovery are not
  implemented.
- One shared engine per device. The terminal and web UI share sessions; they
  are not isolated servers.
- iOS cannot run the local container; it is remote-only (later phase).
- The native payload is large (hundreds of MB) and ships out of git.
