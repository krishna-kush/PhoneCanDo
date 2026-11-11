# Architecture

PhoneCanDo runs coding agents on an Android phone. Each agent is one
instance of an agent kind (opencode, Claude Code, Gemini CLI, …), has its
own engine, and lives in its own image: a VM-like Linux machine through
proot, or, without Linux, an Android one. Home is the active agent's own
UI: its web UI (opencode) or its TUI (Claude Code, Gemini CLI). Terminals
run over our JNI PTY, rendered by xterm.js in a WebView.

## Product shape

```
RN shell (Expo / Tamagui / Zustand)
  ├─ Home ── web UI (pair code) | TUI (engine's PTY) ── active agent
  │    └─ drawer (agents, New agent, Models, Systems, Settings) → pages over Home
  ├─ Terminal (a page) ── xterm.js WebView ── JNI PTY ── agent TUI client | image shell
  ├─ Agent pages, Systems (envs, machines) / Settings (app-wide)
  └─ engine seam (app/src/engine)
        │
        ├─ phonecando-runner ── foreground service ── engines (≤ 3, one per agent)
        │       └─ loopback bridge ── mobile_* tools, MCP (one token per agent)
        ├─ phonecando-linux ── lre/ ── images in files/images/<id>/
        │       └─ shims ── launcher ── proot ── guest commands
        ├─ phonecando-models ── lme/ ── models in files/models/
        │       (lme/ and lre/ both download through network/)
        └─ phonecando-terminal ── libphonecando_pty.so, hosted PTYs
```

- Several agents, one engine each. The runner's foreground service anchors
  every engine; any number may run, and when the phone nears its memory
  peak the runner warns, then stops the least recently used one itself
  (the user's optional cap in Settings stops an idle one to make room, or
  refuses the start). The header switches the active agent; Home and the
  terminal follow it.
- The agent's own UI owns projects and sessions end to end. There is no
  app-side chat or project creation.
- For a web-home kind the terminal is a TUI client of the same engine
  (`surfaces.terminal.client`), so both stay on one live session; for a
  TUI-home kind it is a Linux shell in the agent's image.
- Full builds add the PCE automation stack; play builds strip the
  accessibility host and PCE, and ship no Linux. See
  `../../app/docs/modules/bridge.md` and
  `../../app/docs/modules/automation.md`.

## Agents and engines

- **Agent** — a coding agent the phone runs: one instance of an agent kind
  with its own name, image, engine, port, password and bridge token.
  opencode is the first kind; nothing in the app or docs may assume it is
  the only one.
- **Engine** — the local process that hosts one agent, supervised in the
  runner's foreground service. Two styles: a `server` engine (opencode:
  `opencode serve` on loopback, with its own web UI as Home) and a `tui`
  engine (the kind's own TUI in a PTY the service owns, through
  `phonecando-terminal`'s `PtyHost`; it keeps running when you leave the
  app, and Home reattaches with its screen replayed). In docs, "engine"
  never means opencode; write "opencode engine" when you mean that one.
- **Env** and **image** — see Linux runtime below. One agent per image; they
  are made and deleted together.
- **`oc-`** — opencode's manifest `prefix`, used only where its files sit
  in a flat namespace next to other kinds': the `liboc-*.so` payload, the
  `oc-payload-arm64` CI artifact, the `oc-v2` build workdir. Everything
  else of a kind lives in its one folder, `agents/<type>/<id>/`
  (opencode: `agents/native/opencode/`), whose files need no prefix.
  Generic seams (`app/src/engine/`, `phonecando-runner`) never name a kind;
  kind-neutral agent code (the phone tools) lives in
  `agents/shared/phone-tools/`.
- **Upstream names are frozen** — `opencode.json`, `OPENCODE_*` env vars,
  `~/.config/opencode/`, `~/.local/share/opencode/`, the web UI and plugin API
  come from upstream opencode; do not rename them.

Everything agent-specific (launch, auth, readiness, events, chat titles,
web UI pairing and theme, TUI recipe, install, config, payload) is data in
that kind's `agent.json`, plus code hooks only where data can't say it
(opencode: its SSE event parser). `agents/native/<id>/` is built by us and
runs from the APK lib dir outside proot; `agents/image/<id>/` is installed
into the agent's machine and runs in proot; `agents/runtimes/<id>/` (Node,
…) is installed only for a kind that asks for it. The runner's
`KindCatalog` turns each packaged manifest into a generic `ManifestKind`
and never imports a kind. JS sees only a `KindView` (no templates, no
secrets) through `app/src/engine/agents/registry.ts`, and pairing, idle
and the TUI recipe are native calls. Adding a kind means a folder in
`agents/`, not conditionals in screens. Rules: `../../agents/AGENTS.md`.

## Linux runtime

In full and lite an agent's image is VM-like Linux through proot (or
Android, when Linux cannot run or first launch continues without it); play
ships no Linux and uses Android images only. Depth (modules, contracts,
builds, tests, limits): `../../lre/docs/README.md`.

- **Env** — a fixed base OS, never modified: the **Default** env (a
  Debian-based arm64 rootfs baked into the APK as one xz layer, from
  `lre/images/default/`; works offline), an **Own** env (any linux/arm64
  image picked from a container registry, browsed through Docker Hub's
  catalog; its layers are downloaded once and kept compressed and
  digest-verified under `files/envs/<id>/`; Docker Hub official images fall
  back to `public.ecr.aws` and `mirror.gcr.io` when Docker Hub limits or
  fails), or **Android** (no Linux: the agent runs commands with Android's
  shell).
- **Image** — a machine made from an env, at `files/images/<id>/`
  (`lre/api` `ImageLayout`): `rootfs/` (the system, replaced whole on
  reset), `home/` (the agent's HOME: config, chats, projects, keys; survives
  reset), `tmp/`, `shims/`, `logs/` and `run/` (the files the runner and the
  launcher read). Setup runs `space → unpack → detect → fixups → shims →
  seed`, each step idempotent and recorded, so a killed setup resumes at the
  step that failed. Detect reads the OS, its package-manager family and
  shell; fixups set DNS, hosts, hostname and the package manager's proot
  fix. Which of an agent's tools the image lacks is asked when needed
  (`checkTools`, with the kind's commands), with the line that installs
  them. Reset unpacks a fresh base next to the old one and
  swaps it in by rename, keeping `home/`; packages installed by hand are
  offered for reinstall afterwards, and an installed agent of a kind with an
  install is offered "Reinstall <agent>" (its runtimes and itself live in
  `home/`; the system packages it needs do not).
- **How commands run.** A native kind's engine stays a bionic binary run
  from the native-library dir (an image kind's runs in the guest through
  `shims/sh`, with guest paths). `run/engine.env` gives it HOME and TMPDIR (host paths),
  `SHELL` = `shims/bash`, a `PATH` with `shims/` first,
  `PHONECANDO_IMAGE` and `MAKEFLAGS=-j4` (Android kills an app's processes
  past a device-wide limit; the OS note tells the agent so). Each shim is a
  symlink to our launcher
  (`libphonecando_launch.so`, `lre/launcher/`), which reads
  `run/launch.conf` (contract: `lre/launcher/src/conf.h`) and runs proot
  (`libproot.so` with its unbundled `libproot-loader.so`), which runs the
  command in the guest as fake root. `home/` and `tmp/` are bound at
  `/root` and `/tmp` and at their own host paths under every spelling of the
  data dir, so the engine's file tools and its commands see the same paths.
  Secrets the engine holds are unset for guest commands: JS passes their
  names with every `prepareImageForStart`, and `launch.conf` drops them
  and `LD_*`. As on a PC, a
  command returns when it ends while its background jobs keep running, and
  the terminal's shell has job control and hangup
  (`lre/docs/overview/architecture.md` → Background processes). Background
  processes carry `PHONECANDO_IMAGE`, and a reset or delete
  stops every process with the image's tag first (`ImageReaper`: SIGTERM,
  then SIGKILL after 3 s). Each start writes
  the image's OS note (`run/os-note.md`) into the agent's instructions.
- **Code.** `lre/` is a pure-JVM Gradle build: `api` (shared types, the
  image layout), `tar` (unpacking), `oci` (registry client, Docker Hub
  catalog), `image` (setup, reset, delete) and `cli` (the same download and
  setup on a plain JVM, for CI); dependency law in `../../lre/AGENTS.md`.
  Beside it: `lre/launcher/` (C), `lre/proot/` (a pinned termux/proot build;
  MIT build scripts) and `lre/images/default/` (the Default image build; its
  `lock.json` names the image the APK ships). `app/modules/phonecando-linux/`
  is the Android host: env and image records (`files/state/envs.json`,
  `images.json`), long jobs with progress events, setup, reset, delete, the
  per-start refresh, guest scripts and commands (an agent's install as a
  job that logs to `logs/install.log`, its version check), terminal
  recipes and the catalog; it builds the launcher
  (CMake) and packages the staged proot libs and Default image in full and
  lite. JS reaches it only through `app/src/engine/linux/`;
  `app/src/state/linux.ts` mirrors its records, `app/src/state/flows/`
  composes the multi-step actions (first launch, new agent, Own env, reset,
  delete), and the screens are the agent and system pages
  (`app/src/ui/env/`) and first launch (`app/src/ui/setup/`). The runner reads only the image files an
  engine needs and never depends on `lre/`.

## Boundaries

- **Host vs PCE.** The host owns the HTTP bridge, auth, biometric gate, master
  switch, AI tool names, prompts, UI, app lifecycle, foreground service and
  notifications. The PCE owns observation, snapshots, selectors, typed
  actions, verification, trace and packs. The PCE must stay free of app/
  React Native types. See `pce/AGENTS.md` and `pce/docs/overview/architecture.md`.
- **UI vs engine seam.** `app/src/engine/` is the only importer of native
  modules. Screens stay separate from native details.
  `app/src/engine/runner.ts`, `terminal.ts` and `linux/native.ts` are the
  only importers of `modules/*`; `files.ts` and `auth.ts` wrap the Expo file
  system and biometrics.
- **Native vs CNG.** All native code lives in Expo modules under
  `app/modules/` and is autolinked. Nothing is hand-edited in `app/android/`
  (CNG-generated, gitignored).
- **App vs LRE.** `lre/` knows nothing of Android or the app; the app's
  settings plugin includes it as a composite build
  (`app/plugins/withLreCompositeBuild.js`), and only `phonecando-linux`
  depends on it.
- **App vs TCE.** `tce/` is the usage-data backend and client SDK, with its
  own dependency law (`tce/AGENTS.md`). Only `app/src/engine/telemetry/`
  imports it (`tce/client`, `tce/core`); the site only posts its page-view
  beacon and links its downloads to the API host (`api.phonecando.app/v1/*`).
  The Cloudflare Worker that serves `web/dist` on `phonecando.app` and the
  `/v1` routes on `api.phonecando.app` lives in `tce/hosts/cloudflare/`.
- **Docs vs code.** Repo-wide docs live under `docs/`, app/engine docs under
  `app/docs/`, PCE docs under `pce/docs/`, and TCE docs under `tce/docs/`.
  `research/` holds background notes.

## Repo map

| Area | Path | Docs |
|---|---|---|
| Root shell | `app/App.tsx`, `app/index.ts` | this page |
| Feature screens | `app/src/ui/{chat,terminal,env,setup,settings,accessibility,common}/` | `../../app/docs/modules/chat.md`, `../../app/docs/modules/terminal.md` |
| State and flows | `app/src/state/` | this page |
| Engine seam | `app/src/engine/` | `../../app/docs/modules/runner.md` |
| Native modules | `app/modules/{phonecando-terminal,phonecando-runner,phonecando-linux}/` | `../../app/docs/modules/terminal.md`, `../../app/docs/modules/runner.md`, this page |
| Terminal page | `app/assets/xterm/` | `../../app/docs/modules/terminal.md` |
| Agent kinds (kit, native, image) | `agents/` | `../../agents/AGENTS.md` |
| opencode payload build | `agents/native/opencode/build/` | `../../agents/native/opencode/docs/build.md` |
| Linux runtime (LRE) | `lre/` | `../../lre/docs/README.md`, this page |
| PCE | `pce/` | `../../pce/docs/README.md` |
| Marketing site | `web/` | `../../web/README.md` |
| Telemetry (TCE) and the Worker | `tce/` | `../../tce/README.md`, `../telemetry.md` |
| Docs | `docs/` | `../README.md` |

## Why this shape

`127.0.0.1` plus a native PTY is deliberate. The TUI needs a PTY and
`node-pty` has no Android arm64 prebuild, so the app ships its own JNI
`forkpty` and renders with xterm.js. `serve` gives structured sessions,
diffs and permission records, survives background work, and lets all of an
agent's chats share one process. The terminal tab gives the full TUI 1:1
with no reimplementation.

proot gives each agent a real Linux userland (its own package manager, git,
toolchains) without root or kernel features an app cannot use. Android lets
an app exec only from its native-library dir, so the launcher, proot and its
loader ship there as `lib*.so`, and everything else an image holds is data.

The full payload is a self-built bionic opencode engine with the web UI embedded; see
`../../app/docs/modules/runner.md` and `../../app/docs/context.md`.
