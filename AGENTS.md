# AGENTS.md — PhoneCanDo (coding agents read this first)

On-device opencode chat for Android. RN UI talks to a local `opencode serve`
(foreground service, dynamic port — first request :4097, service persists
last-good and picks a free one when squatted; see `ensureServe.ts`). The home
tab is the pair-loaded opencode web UI; the terminal tab is a full TUI over an
own JNI PTY, rendered by xterm.js in a WebView.

Engine = the local host for one agent; opencode is the first. New
opencode-specific files get an `oc-` prefix; generic seams (`app/src/engine/`,
`phonecando-runner`) stay unprefixed — see `docs/overview/architecture.md`.

## Layout

- `app/App.tsx`, `app/index.ts` — root (Tamagui + KeyboardProvider + SafeArea).
- `app/src/ui/{chat,terminal,env,settings,common}/` — feature screens.
  Terminal split: `TerminalScreen.tsx` (layout only) + `keys.ts`,
  `reconcile.ts`, `sizing.ts` (pure, zero RN imports) + `usePtySession.ts`,
  `useMirrorInput.ts` (hooks) + `ExtraKeysBar.tsx`.
- `app/src/engine/` — the ONLY importer of native modules (`terminal.ts`
  recipe/transport, `runner.ts` prefix). Screens stay dumb.
- `theme/tokens.json` — the ONLY palette (dark + light, web-sourced). Web
  (`Base.astro`) and app (`globals/theme.ts`, `tamagui.config.ts`) read it
  directly; never hardcode a theme colour on either side. Brand/favicon
  assets are generated from it by `scripts/make-logos.mjs` (`pnpm logos`);
  native icon changes need `expo run:android`. `theme/logo.json` is the one
  shadow + loader spec: web CSS is generated from it in
  `web/src/lib/logoLoaderCss.ts`; the app imports it directly.
- `app/src/state/` — zustand stores (`enginePort`: first request `'4097'`,
  adopted from the service via `getServePort`; never user-edited).
- `app/modules/{phonecando-terminal,phonecando-runner}/` — own Expo modules
  (Kotlin/JNI `forkpty.c` + TS shims, clean-room). Never Termux code.
  Agent config source: `app/modules/phonecando-runner/opencode-config/`.
- `app/assets/xterm/` — `terminal.js` (page source), `terminal.bundle.html`
  (generated; `node scripts/inline-xterm.js` after page edits).
- `docs/README.md` — repo docs map; `app/docs/README.md` — app/engine docs.
  Read `app/docs/modules/*.md` and `app/docs/context.md` before
  touching native/IME/sizing/automation code. `research/` holds background notes
  and open questions.
- `docs/bootstrap/` — opencode payload build docs; `scripts/bootstrap/` — engine
  build/stage scripts and patches. `reference/` is a gitignored local-clone
  area, not a build input.
- `pce/` — separate Gradle phone-control engine (PCE) build owned by PhoneCanDo;
  read `pce/AGENTS.md`, plan in `pce/docs/planning/plan.md`, work in
  `pce/docs/planning/todo.md`.
  Keep its modules free of PhoneCanDo/React Native types.

## Dev loop (physical Android 16 device on adb, Metro :8081)

- JS/asset-only: reload from Metro. No rebuild.
- `modules/*/android`, `android/`, manifest, native deps: `expo run:android`.
- New JS native-module imports: restart Metro with `--clear` (stale haste
  map fails "Unable to resolve"). `adb reverse tcp:8081 tcp:8081`.
- Verify with `tsc --noEmit`, `pnpm check:vectors`, logcat
  (`[phonecando-kb]`, `[phonecando-size]`), and `adb exec-out screencap`.

## Rules

1. Evidence before synthesis: read files, run code, screenshot. Never ship
   a sizing/layout claim without pixels or logs.
2. No per-device numbers: cells from xterm runtime, keyboard from live
   native height, backgrounds matched to the TUI (`#0a0a0a`), not `#000`.
3. IME contract is load-bearing: plain-text field, absolute 1x1 overlay
   (Android multiline min-height eats layout), mirror === remote line —
   fold EVERY text-inserting path into the shadow or backspace breaks.
   Never `visible-password` (kills mic/glide/predictions).
4. Pure logic stays pure (testable via `app/scripts/vectors/`); keep vectors in
   sync with `keys.ts`/`reconcile.ts` or delete them.
5. Reanimated worklets: imported fns need the `'worklet'` directive;
   prove on-device, not just `tsc`.
6. Debug dyes (red/blue/yellow) are temporary: always revert to production
   colors before finishing.
7. One concern per commit-sized change. The base
   commit gets amended as work lands — check `git log`/`git show HEAD`
   before assuming what HEAD contains.
8. Never run git commands, at all (no status/diff/log/add/commit) — the
   user owns all git operations; use file tools and report, don't verify
   via git.
9. PCE work: read `pce/AGENTS.md`. The PCE is a separate Gradle build
   owned by PhoneCanDo; modularity, dependency direction and typed errors are
   quality gates.
