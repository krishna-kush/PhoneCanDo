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
- `mobile_home` backgrounds PhoneCanDo. While an agent drives the screen
  (a screen call now or in the last 30 s) the runner's idle stop stops
  nothing.
- With the app in the background an idle agent stops once nothing it
  started still runs (`app/docs/modules/runner.md` → Jobs and the idle
  stop). The rule tells jobs from the agent's own helpers by when they
  started and what their stdin is, so a job started before the user's
  first message (a startup hook) can still be stopped with its agent, and
  a helper started later with no stdin pipe (a build daemon) keeps its
  agent up; the notification names what keeps an agent up, with Stop.
  Keep running on the agent page keeps it either way.
- The CPU stays awake (a wake lock) while an engine starts, a chat works,
  a model or Linux job runs, or an agent's job did something in the last
  minute. A job that
  waits quietly (a dev server between requests) lets the phone sleep, and
  then it answers only once the phone wakes.
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
- Release builds ship without a pack key, so `mobile_pack` refuses every
  pack ("No trusted pack public key is configured"); agents drive apps with
  the other phone tools. No packs are published yet; the key arrives with
  the first ones (`docs/planning/todo.md`, Packs). Debug builds use a
  test-only key.
- The bridge bearer is per agent (made with the agent, kept for its
  lifetime) and loopback-only. `open`/`share` work only while the app is
  foreground; clipboard reads report `available:false` to background apps
  (API 29+).
- With several agents running, one drives the screen at a time: the others
  wait in line (`control_busy` with their place) and get a message when it is
  theirs, after the holder hands it back or has been idle for 30 s. In
  "Once" and "Each launch" lock modes one unlock lets every agent in; "Each
  ask" unlocks one agent at a time.
- Agent messages reach each kind at its level (shown in the app). opencode
  (through its server) and every kind with an ACP mode and phone tools
  (Claude Code, pi, Gemini, Qwen, Copilot, Cursor, Mistral Vibe, Kimi,
  goose) get them in their turns and are woken while idle; a stopped one
  is started in the background for a direct message that asks to wake it,
  while "Other agents can wake it" is on and the phone has memory to spare
  (never past your cap on running agents, nor within 10 minutes of a
  failed start, a silent turn or a stop to free memory). An agent you
  stopped by hand is started again by the next such message: switch it
  off to keep the agent stopped. A turn in the background that shows
  nothing for 3 minutes (no text, no tool call or one still running, no
  question, no local model at work on it) is cancelled and the agent
  stopped, with a
  notice: ACP mode can't show what the agent may be waiting for in its
  own app (a sign-in, a folder to trust), nor a provider limit it keeps
  retrying. Gemini CLI in a folder it doesn't trust works in ACP mode
  without its hooks and phone tools and asks nothing there: its check
  marks its phone tools Not working, and you trust the folder in its own
  app. When a check finds an agent's ACP mode not working (a
  sign-in only ACP mode wants), it falls back to its hooks: Claude Code is
  woken only while the hook it leaves after a turn still waits (about an
  hour), pi through its reader, Gemini, Qwen, Copilot, Cursor and Vibe get
  messages in their turns but are never woken, and Kimi and goose read them
  only when they check their inbox. Codex gets them in its turns but is
  never woken or started. aider, crush and cline have no phone tools, so
  messages to them are refused. Kimi and Vibe agents keep their own home folder
  (`~/.kimi-code-agent`, `~/.vibe-agent`), so a `kimi` or `vibe` run by hand
  in a terminal signs in on its own.
- The bridge shell runs as the PhoneCanDo UID, so its package listing is
  filtered; it is not proof an app is missing.

## opencode payload and platform

- Android 10 (API 29) or newer: the payload is built for API 29, so the app's
  minSdk is 29 (`app/plugins/withMinSdk.js`; CI's emulator floor leg runs it).
- opencode is pinned to the self-built `v2.0.26-android-phonecando.3`
  payload. Bumping it requires re-checking the embedded web UI theme override
  (`--v2-*` variables and `opencode-color-scheme`); a rename fails silently.
- A run cut off mid-task (the phone restarted, PhoneCanDo was updated or
  closed by Android, or the agent's engine stopped by itself) does not go
  on by itself: a notice per agent asks first, and Continue starts the agent
  again in the same chat with a note to go on (`app/docs/modules/runner.md`
  → Cut-off runs). It needs notifications allowed, the notice comes after
  the first unlock, and runs older than a day, or whose agent showed no
  sign of work for an hour before, are not offered. Kinds that
  cannot reopen their chat with a first prompt (aider, crush, cline, Gemini
  CLI and Kimi in their own app) get Open instead, and you go on yourself. What the agent left running
  (servers, builds) is not brought back. A force stop or a swipe that ended
  PhoneCanDo, quitting an agent's TUI yourself (Ctrl+C, `/exit`) and
  cancelling an update's installer count as your stop: nothing is offered.
- The engine's foreground service is type `specialUse`, which Android gives
  no time limit (`dataSync`, which we used before, stops after 6 hours in
  any 24 in the background on Android 15+). A Play release needs Play's
  review of that type; what we do if Play refuses it is in
  `docs/planning/todo.md`.
- Battery-exemption prompting is not implemented, and a dead engine is not
  restarted by itself: one that died mid-task offers Continue (above);
  otherwise the next start (its chat or terminal opening, or the app coming
  to the foreground for the active agent) launches it again.
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
- Reset replaces an image's system and keeps `home/`; packages installed by
  hand are offered for reinstall, not reinstalled by themselves.
- Unix socket paths are capped at 108 bytes; image setup flags an image
  whose `home/` or `tmp/` leaves too little room for socket names.
- The native payload is large (hundreds of MB) and ships out of git.
