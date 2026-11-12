# Status

As of 2026-11-07. Device evidence is Android 16 / API 36.

## App and engine

- opencode payload: self-built bionic `opencode v2.0.26-android-phonecando.1`
  (`liboc-engine.so` + `liboc-opentui.so`), web UI embedded, pair API live.
- Several agents, each with its own engine in the runner's foreground
  service (no cap by default: near the memory peak the runner warns, then
  stops the least recently used one; optional caps in Settings), its own
  loopback port, password and bridge token. Engines are
  auth-first and quiet when idle; a dead engine is relaunched by the next
  start. Agent records live in `files/state/agents.json`.
- Home is the active agent's pair-loaded web UI, re-paired on every switch;
  the header switches agents. The terminal tab is the agent's TUI, or a
  shell in its image, over the own JNI PTY. Sessions and projects live in
  the web UI.
- The loopback bridge (one for all agents, a token per agent), `mobile_*`
  tools, biometric/master-switch gate, per-request prompts, screen lease
  (one agent drives the screen at a time; the others wait in line and get a
  message when it is theirs) and full/lite/play channel split are live.
- Agents list and message each other on the whole phone (`agents_*` tools on
  the bridge; delivery through each kind's hooks, plugin or server; waking an
  idle agent behind a per-agent switch) and the app's Messages page shows
  what they send. Built and unit-tested, not yet tried on a device.
- The `play` channel builds but is a later feature: nothing is released from
  it and it is untested on a device.
- The sideload path is device-proven (2026-11-03, Android 16, India): lite
  installs from a file manager, installs full in place through the normal
  installer, Play Protect allows it, and the accessibility service enables
  after "Allow restricted settings" (`docs/release/upgrade-test.md`).
- The three-step accessibility guide (Android's "Restricted setting" note
  shown in place, App info → Allow restricted settings, the switch) is
  device-verified on the Moto G96 (2026-11-04,
  `research/restricted-settings.md`). Not yet on a device: the agent waiting
  for the switch and carrying on by itself, the update dialog's own
  "Install unknown apps" step, and the compact step links.
- `activityName` and `eventSeq` are device-verified. The staged
  `mobile_wait` eventSeq comparison lands with the next APK because the
  generated asset was stale.

## Linux images

- In full and lite an agent's image can be VM-like Linux through proot:
  the Default env (a Debian-based image baked into the APK), Own envs from
  container registries, and the Android env (no Linux, the only one in
  play). Each agent has its page, Systems lists the envs, and first launch
  makes the first agent and its machine.
- Device-proven 2026-11-06 (Moto G96, full debug build): proot with its
  unbundled loader runs from the engine's own process, the launcher runs by
  its own name and through a symlinked shim, an Alpine image works as fake
  root with `apk`, the engine's secrets are scrubbed, and there are no exec
  denials. The hardened PTY passed on the same phone.
- Not yet proven on a device: several engines at once, the agent pages, New
  agent and first launch end to end, the dead-engine relaunch, and the baked Default image.
- `lre/images/default/lock.json` locks no image yet, so builds carry the
  Default image only when one is staged locally (`./manage image stage
  --local`, debug builds); release builds refuse to ship without one unless
  told `--without-linux`.
- CI: `lre.yml` (runtime modules and launcher), `proot.yml` (the arm64 build
  and a glibc build booting Alpine), `lre-image.yml` (the Default image,
  reproducible and tier 1 through launcher and proot) and `lre-compat.yml`
  (one registry image per package family, plus a weekly report-only
  rotation); see `../guides/testing.md`.

## Automation

- The PCE-backed slice is live in full builds: `GET /pce/describe`,
  `POST /pce/observe`, `POST /pce/act`, `POST /pce/pack` and
  `mobile_describe/observe/act/pack`.
- Signed pack lifecycle is device-proven: install, idempotent refresh,
  v2→v1 rollback, signature rejection, incompatible pack rejection, and
  active-pack flow execution with step `expect` and flow `verify`.
- Play builds contain no accessibility service, `uiauto`/PCE/pack classes or
  `accessibility_config` resource.
- Not yet: `mobile_execute`, `mobile_flow`, `mobile_doctor`, explicit
  screenshot action, pack crypto below API 33, granted-path Shizuku, vision
  backend.

## PCE modules

- Green: `api`, `core`, `json`, `pack`, `testkit`, `sample`, `android`, `ime`.
- WIP, not in the v1 router: `shizuku` (unavailable path tested; granted path
  and `newProcess` → `UserService` migration await work).
- Details: `pce/docs/overview/status.md`.

## Work tracking

- `research/` — background notes and open questions.
- `pce/docs/planning/todo.md` — open PCE work.
- `../release/known-limits.md` — cross-module limits.
