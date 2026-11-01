# Architecture

PhoneCanDo is an on-device agent chat app for Android; opencode is the first
agent. The RN shell talks to a local engine (`opencode serve` today); the home
tab is the pair-loaded opencode web UI, and the terminal tab is a full TUI over
an own JNI PTY rendered by xterm.js in a WebView.

## Product shape

```
RN shell (Expo / Tamagui / Zustand)
  ├─ Home tab ── WebView ── pair code ── opencode serve
  ├─ Terminal tab ── xterm.js WebView ── JNI PTY ── opencode attach
  ├─ Env / Settings tabs
  └─ engine seam (app/src/engine)
        │
        ├─ phonecando-runner ── foreground service ── opencode serve
        │       └─ loopback bridge :9998 ── mobile_* tools
        └─ phonecando-terminal ── libphonecando_pty.so
```

- One shared engine per device, many sessions. A single foreground service
  supervises `serve`; the app adopts the service-owned dynamic port.
- The web UI owns projects and sessions end to end. There is no app-side chat
  or project creation.
- The terminal is a separate view of the same engine, not a second server.
  The recipe is `libopencode2.so --server <url> [--session <id>] <dir>`,
  so the terminal and web UI stay on one live session.
- Full builds add the PCE automation stack; play builds strip the
  accessibility host and PCE. See `../../app/docs/modules/bridge.md` and
  `../../app/docs/modules/automation.md`.

## Agents and engines

- **Agent** — a coding agent the phone runs. opencode is the first; nothing in
  the app or docs may assume it is the only one.
- **Engine** — the local process that hosts one agent. Today that is
  `opencode serve` in the runner's foreground service. In docs, "engine" never
  means opencode; write "opencode engine" or "opencode payload" when you mean
  that specific one.
- **`oc-`** — prefix for opencode-specific things we own: the `oc-v2` build
  workdir, and the planned `oc-config/` + `oc-*` payload names. Generic seams
  (`app/src/engine/`, `phonecando-runner`) stay unprefixed.
- **Upstream names are frozen** — `opencode.json`, `OPENCODE_*` env vars,
  `~/.config/opencode/`, `~/.local/share/opencode/`, the web UI and plugin API
  come from upstream opencode; do not rename them.

Agent-specific code (serve command, auth, sessions REST/SSE, payload, web UI)
stays behind `app/src/engine/`; screens and state import the seam, not an
agent. Adding an agent means adding an implementation there, not conditionals
in screens.

Debt: `opencode-config/` and `libopencode2.so` predate the `oc-` rule; they
rename only with a native rebuild.

## Boundaries

- **Host vs PCE.** The host owns the HTTP bridge, auth, biometric gate, master
  switch, AI tool names, prompts, UI, app lifecycle, foreground service and
  notifications. The PCE owns observation, snapshots, selectors, typed
  actions, verification, trace and packs. The PCE must stay free of app/
  React Native types. See `pce/AGENTS.md` and `pce/docs/overview/architecture.md`.
- **UI vs engine seam.** `app/src/engine/` is the only importer of native modules.
  Screens stay separate from native details. `app/src/engine/runner.ts` and
  `app/src/engine/terminal.ts` are the only importers of `modules/*`.
- **Native vs CNG.** All native code lives in Expo modules under
  `app/modules/` and is autolinked. Nothing is hand-edited in `app/android/`
  (CNG-generated, gitignored).
- **Docs vs code.** Repo-wide docs live under `docs/`, app/engine docs under
  `app/docs/`, and PCE docs under `pce/docs/`. `research/` holds background
  notes.

## Repo map

| Area | Path | Docs |
|---|---|---|
| Root shell | `app/App.tsx`, `app/index.ts` | this page |
| Feature screens | `app/src/ui/{chat,terminal,env,settings,common}/` | `../../app/docs/modules/chat.md`, `../../app/docs/modules/terminal.md` |
| State | `app/src/state/` | this page |
| Engine seam | `app/src/engine/` | `../../app/docs/modules/runner.md` |
| Native modules | `app/modules/{phonecando-terminal,phonecando-runner}/` | `../../app/docs/modules/terminal.md`, `../../app/docs/modules/runner.md` |
| Terminal page | `app/assets/xterm/` | `../../app/docs/modules/terminal.md` |
| opencode build | `docs/bootstrap/`, `scripts/bootstrap/` | `../bootstrap/oc-build.md` |
| PCE | `pce/` | `../../pce/docs/README.md` |
| Marketing site | `web/` | `../../web/README.md` |
| Docs | `docs/` | `../README.md` |

## Why this shape

`127.0.0.1` plus a native PTY is deliberate. The TUI needs a PTY and
`node-pty` has no Android arm64 prebuild, so the app ships its own JNI
`forkpty` and renders with xterm.js. `serve` gives structured sessions,
diffs and permission records, survives background work, and lets many chats
share one process. The terminal tab gives the full TUI 1:1 with no
reimplementation.

The full payload is a self-built bionic opencode engine with the web UI embedded; see
`../../app/docs/modules/runner.md` and `../../app/docs/context.md`.
