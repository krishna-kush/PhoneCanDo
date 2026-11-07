# Architecture

PhoneCanDo runs coding agents on an Android phone; opencode is the first
agent kind. Each agent has its own local engine (`opencode serve` today) and
lives in its own image: a VM-like Linux machine through proot, or, without
Linux, an Android one. The RN shell talks to the engines over loopback; the
home tab is the active agent's pair-loaded web UI, and the terminal tab is
its full TUI, or a shell in its image, over an own JNI PTY rendered by
xterm.js in a WebView.

## Product shape

```
RN shell (Expo / Tamagui / Zustand)
  ├─ Home tab ── WebView ── pair code ── active agent's engine
  ├─ Terminal ── xterm.js WebView ── JNI PTY ── agent TUI | image shell
  ├─ Env tab (envs, machines, agents) / Settings (app-wide)
  └─ engine seam (app/src/engine)
        │
        ├─ phonecando-runner ── foreground service ── engines (≤ 3, one per agent)
        │       └─ loopback bridge ── mobile_* tools (one token per agent)
        ├─ phonecando-linux ── lre/ ── images in files/images/<id>/
        │       └─ shims ── launcher ── proot ── guest commands
        └─ phonecando-terminal ── libphonecando_pty.so
```

- Several agents, one engine each. The runner's foreground service anchors
  every engine; at most three start or run at once, and a further start
  stops the least recently used engine that has been idle for a minute (or
  is refused). Each engine has its own loopback port, password and bridge
  token. The header switches the active agent; chat and the terminal follow
  it.
- The web UI owns projects and sessions end to end. There is no app-side chat
  or project creation.
- The terminal is a separate view of the agent's engine, not a second
  server. The recipe is `liboc-engine.so --server <url> [--session <id>] <dir>`,
  so the terminal and web UI stay on one live session. The agent page also
  opens a login shell in the agent's image.
- Full builds add the PCE automation stack; play builds strip the
  accessibility host and PCE, and ship no Linux. See
  `../../app/docs/modules/bridge.md` and
  `../../app/docs/modules/automation.md`.

## Agents and engines

- **Agent** — a coding agent the phone runs: one instance of an agent kind
  with its own name, image, engine, port, password and bridge token.
  opencode is the first kind; nothing in the app or docs may assume it is
  the only one.
- **Engine** — the local process that hosts one agent. Today that is
  `opencode serve`, one per agent, supervised in the runner's foreground
  service. In docs, "engine" never means opencode; write "opencode engine"
  or "opencode payload" when you mean that specific one.
- **Env** and **image** — see Linux runtime below. One agent per image; they
  are made and deleted together.
- **`oc-`** — prefix for opencode-specific things we own where they sit
  next to generic ones: the `oc-v2` build workdir, the `oc-config` assets
  folder, the `liboc-*.so` payload, `oc-payload.yml`. Each agent kind has
  one folder per side named for it (`agents/oc/` in `app/src/engine/`,
  `phonecando-runner` and its Kotlin package, `scripts/agents/oc/`); files
  inside an `oc` folder need no prefix. Generic seams (`app/src/engine/`,
  `phonecando-runner`) stay unprefixed; kind-neutral agent code (the phone
  tools) lives in `phonecando-runner/agents/shared/`.
- **Upstream names are frozen** — `opencode.json`, `OPENCODE_*` env vars,
  `~/.config/opencode/`, `~/.local/share/opencode/`, the web UI and plugin API
  come from upstream opencode; do not rename them.

Agent-specific code (serve command, auth, sessions REST, payload, web UI,
TUI recipe) stays behind the agent-kind seams: `app/src/engine/agents/`
(`types.ts`, `registry.ts`, one folder per kind) and the runner's Kotlin
`agents/` package (`AgentKind`, `AgentKinds`, one folder per kind). Screens
and state look up the kind of the agent in question; adding a kind means a
folder per side plus one registry line, not conditionals in screens.

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
  fix; agent tools the image lacks (bash, git, rg) are listed with the line
  that installs them. Reset unpacks a fresh base next to the old one and
  swaps it in by rename, keeping `home/`; packages installed by hand are
  offered for reinstall afterwards.
- **How commands run.** The engine stays a bionic binary run from the
  native-library dir. `run/engine.env` gives it HOME and TMPDIR (host paths),
  `SHELL` = `shims/bash`, a `PATH` with `shims/` first and
  `PHONECANDO_IMAGE`. Each shim is a symlink to our launcher
  (`libphonecando_launch.so`, `lre/launcher/`), which reads
  `run/launch.conf` (contract: `lre/launcher/src/conf.h`) and execs proot
  (`libproot.so` with its unbundled `libproot-loader.so`) in place, running
  the command in the guest as fake root. `home/` and `tmp/` are bound at
  `/root` and `/tmp` and at their own host paths under every spelling of the
  data dir, so the engine's file tools and its commands see the same paths.
  Secrets the engine holds are unset for guest commands. Background
  processes a command starts keep running after it returns (no
  `--kill-on-exit`); they carry `PHONECANDO_IMAGE`, and a reset or delete
  stops every process with the image's tag first (`ImageReaper`: SIGTERM,
  then SIGKILL after 3 s). Each start writes
  the image's OS note (`run/os-note.md`) into the agent's instructions.
- **Code.** `lre/` is a pure-JVM Gradle build: `api` (shared types, the
  image layout), `tar` (unpacking), `oci` (registry client, Docker Hub
  catalog), `image` (setup, reset, delete) and `cli` (the same download and
  setup on a plain JVM, for CI), with the law api ← tar, api ← oci,
  api + tar ← image, oci + image ← cli (no `android.*`, no `org.json`).
  Beside it: `lre/launcher/` (C), `lre/proot/` (a pinned termux/proot build;
  MIT build scripts) and `lre/images/default/` (the Default image build; its
  `lock.json` names the image the APK ships). `app/modules/phonecando-linux/`
  is the Android host: env and image records (`files/state/envs.json`,
  `images.json`), long jobs with progress events, setup, reset, delete, the
  per-start refresh, terminal recipes and the catalog; it builds the launcher
  (CMake) and packages the staged proot libs and Default image in full and
  lite. JS reaches it only through `app/src/engine/linux/`;
  `app/src/state/linux.ts` mirrors its records, `app/src/state/flows/`
  composes the multi-step actions (first launch, new agent, Own env, reset,
  delete), and the screens are the Env tab (`app/src/ui/env/`) and first
  launch (`app/src/ui/setup/`). The runner reads only the image files an
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
| opencode build | `docs/bootstrap/`, `scripts/agents/oc/` | `../bootstrap/oc-build.md` |
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
