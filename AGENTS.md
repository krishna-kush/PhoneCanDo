# AGENTS.md — PhoneCanDo (coding agents read this first)

On-device coding agents for Android. Each agent is one instance of an agent
kind (opencode built in; Claude Code, Gemini CLI installed into its machine)
with its own engine in the runner's foreground service: up to three at
once, each with its own bridge token (a server engine also gets its own
loopback port and password); JS starts them through `ensureEngine.ts`.
Each agent lives in its own image: VM-like Linux through proot, or Android
without Linux. Home is the active agent's own UI (opencode's pair-loaded
web UI, or the kind's TUI); terminals run over our JNI PTY, rendered by
xterm.js in a WebView.

Engine = the local host for one agent; opencode is the first. Each agent
kind is one folder in `agents/` named by its id; its `oc-`-style prefix is
used only where it meets other kinds' files in a flat namespace (`liboc-*.so`,
the `oc-payload-arm64` artifact). Generic seams (`app/src/engine/`,
`phonecando-runner`) never name a kind — see `docs/overview/architecture.md`.

## Layout

- `app/App.tsx`, `app/index.ts` — root (Tamagui + KeyboardProvider + SafeArea).
- `app/src/ui/{chat,terminal,env,setup,settings,accessibility,common}/` —
  feature screens. `accessibility/` is the whole Accessibility setup guide:
  `guide.ts` (pure: the `RESTRICTED_FLOW` switch, steps and every line of
  copy), the hook, the step list, the Settings block and the agent's dialog.
  Terminal split: `TerminalScreen.tsx` (session shell) + `TerminalView.tsx`
  (the IME, mirror, sizing and spacer; used by the terminal tab and by a
  TUI-home agent's Home) + `transport/` (local PTY or the engine's hosted
  PTY) + `keys.ts`, `reconcile.ts`, `sizing.ts` (pure, zero RN imports) +
  `usePtySession.ts`, `useMirrorInput.ts`, `useInitialInput.ts` (hooks) +
  `sessionRecipe.ts` (agent TUI client or image shell) + `ExtraKeysBar.tsx`,
  `FolderPicker.tsx`. Home (`chat/HomeScreen.tsx`) is the kind's web UI or,
  for a TUI-style kind, its TUI (`chat/tui/`).
  `env/` is the Env tab: envs (fixed base OS) → machines (one image + its
  agent) → the agent's page, plus New env; pure parts in `env/logic/`.
  `setup/` is first launch (the first agent and its machine). The header
  agent switcher is `common/agent-switcher/`; Settings is app-wide only.
- `app/src/engine/` — the ONLY importer of native modules (`terminal.ts`
  PTY transport, `runner.ts` engine host, `linux/native.ts` Linux runtime,
  `files.ts` file system, `auth.ts` biometrics). Agents and engines:
  `engines.ts`, `ensureEngine.ts`, `connection.ts`; agent kinds through
  `agents/registry.ts` (each kind's `KindView`, from the runner's
  `listKinds`), `agents/webAdapter.ts` and `agents/records.ts`. Screens
  stay dumb.
- `theme/tokens.json` — the ONLY palette (dark + light, web-sourced). Web
  (`Base.astro`) and app (`globals/theme.ts`, `tamagui.config.ts`) read it
  directly; never hardcode a theme colour on either side. Brand/favicon
  assets are generated from it by `scripts/make-logos.mjs` (`pnpm logos`);
  native icon changes need `expo run:android`. `theme/logo.json` is the one
  shadow + loader spec: web CSS is generated from it in
  `web/src/lib/logoLoaderCss.ts`; the app imports it directly.
- `app/src/state/` — zustand stores: `app.ts` (navigation, prefs and
  telemetry slices in `app/`), `agents.ts` (agents, engine states, the
  active agent), `linux.ts` (envs, images, job progress), `keyboard.ts` (keyboard
  open, the footer's height; the per-frame room is a UI-thread value in
  `ui/common/keyboard/room.ts`); multi-step flows in
  `flows/` (pure parts in `flows/logic/`). Ports, passwords and tokens stay
  native, never in JS state.
- `app/modules/{phonecando-terminal,phonecando-runner,phonecando-linux}/` —
  own Expo modules (Kotlin + TS shims, clean-room). The PTY's plain POSIX
  core is `phonecando-terminal/android/src/main/cpp/pty/` (`forkpty.c` is the
  JNI glue). `phonecando-linux` is the Linux runtime's Android host (env and
  image records, jobs, setup/reset/delete, terminal recipes, the Docker Hub
  catalog) and packages the launcher and the staged proot libs and Default
  image (full and lite only; play refuses every Linux path). Its
  `src/linux/dev-assets/` holds a local, unlocked image for debug variants
  only (`./manage image stage --local`). Never Termux code in our own
  modules; programs we ship as-is (opencode, proot from the termux fork) are
  third-party payloads with their own licenses, built from pinned sources.
  The runner packages every agent kind from `agents/` (`agents.gradle`:
  assets `agents/<id>/`, per-channel staged libs in
  `src/agents/<id>/libs/`) and never names a kind; `KindCatalog` reads
  the packaged manifests and binds `BuiltinHooks`. The runner's `engine/` is the supervisor
  (max 3, LRU idle stop, tagged-process reaper), `bridge/` the loopback
  bridge (per-agent tokens, prompts, screen lease).
- `app/assets/xterm/` — `terminal.js` (page source), `terminal.bundle.html`
  (generated; `node scripts/inline-xterm.js` after page edits).
- `docs/README.md` — repo docs map; `app/docs/README.md` — app/engine docs.
  Read `app/docs/modules/*.md` and `app/docs/context.md` before
  touching native/IME/sizing/automation code. `research/` holds background notes
  and open questions.
- `agents/` — every coding-agent kind, one folder each: `kit/` (the SDK:
  contracts, manifest schema + validator, payload staging, conformance,
  `./manage agent new`), `native/<id>/` (built by us for Android, in the
  APK lib dir, outside proot: opencode), `image/<id>/` (installed into a
  machine's image at creation, data only), `builtin/` (the one place code
  hooks are registered), `shared/phone-tools/`. Each kind's `agent.json`
  drives packaging, CI matrices and the APK audit. Pure-JVM Gradle build
  (`cd agents && ./gradlew build`) and own pnpm package
  (`pnpm -C agents check`); read `agents/AGENTS.md` (dependency law,
  naming, adding a kind). opencode's payload build and docs:
  `agents/native/opencode/{build,docs}/` (`./manage agent opencode build|stage`).
  `reference/` is a gitignored local-clone area, not a build input.
- `pce/` — separate Gradle phone-control engine (PCE) build owned by PhoneCanDo;
  read `pce/AGENTS.md`, plan in `pce/docs/planning/plan.md`, work in
  `pce/docs/planning/todo.md`.
  Keep its modules free of PhoneCanDo/React Native types.
- `lre/` — Linux runtime engine: VM-like Linux images through proot; read
  `lre/AGENTS.md`, docs in `lre/docs/README.md`, work in
  `lre/docs/planning/todo.md`.
  `lre/launcher/` is our clean-room C multi-call launcher (the launch.conf
  contract is `src/conf.h`); `lre/proot/` builds the termux proot fork from
  pinned sources (MIT build scripts, `lre/proot/LICENSE`);
  `lre/images/default/` builds the baked Default image, and its `lock.json`
  names the one the APK ships (`./manage image build|fetch|stage
  [--local]|lock`). The pure-JVM Gradle build (`cd lre && ./gradlew build`)
  has `api` (shared types; the on-disk image layout and the `run/` file
  contracts are `ImageLayout`), `tar`, `oci`, `image` and `cli` (download +
  setup on a plain JVM, for CI), with the law api ← tar, api ← oci,
  api + tar ← image, oci + image ← cli (no android.*, no org.json, image
  never imports oci). Overview: `docs/overview/architecture.md` → Linux
  runtime. Only full and lite ship Linux; play has none.
- `tce/` — Telemetry Collection Engine (own pnpm package): usage-data schema,
  ops, stores, hosts, the client SDK and the Cloudflare Worker config
  (`tce/hosts/cloudflare/wrangler.jsonc`, deployed by Workers Builds on push
  to `prod`). Read `tce/AGENTS.md`; open work in `tce/docs/planning/todo.md`.
  Only `app/src/engine/telemetry/` imports it; a new field ships with its
  line in `docs/telemetry.md`.

## Dev loop (physical Android 16 device on adb, Metro :8081)

- Channels (`full|lite|play`) are Gradle product flavors (`withBuildChannel.js`);
  one prebuild serves all, `pnpm android:<channel>` builds `<channel>Debug`.
- Debug builds install per channel as `com.phonecando.app.<channel>.dev`
  ("PhoneCanDo Lite Dev" / "PhoneCanDo Full Dev", `plugins/withDevAppId.js`),
  separate from the release-signed `com.phonecando.app`, so both dev
  channels and production testing share one phone. Debug apps cannot
  self-update (debug signature), and an adb install never gets Android's
  restricted-settings lock (it follows the installer's package source, not
  debuggability), so the lite→full install and the staged accessibility
  flow are release-build tests only.

- JS/asset-only: reload from Metro. No rebuild.
- `modules/*/android`, `android/`, manifest, native deps: `expo run:android`.
  Prebuild runs with `--no-clean` (Expo CLI 57 otherwise deletes and
  regenerates `app/android`), so `app/android` and its compiled outputs
  survive; pass `--clean` to `pnpm android:<channel>` / `./manage build` only
  when a build looks stale.
- New JS native-module imports: restart Metro with `--clear` (stale haste
  map fails "Unable to resolve"). `adb reverse tcp:8081 tcp:8081`.
- Verify with `tsc --noEmit`, `pnpm check:vectors`, the host C tests
  (`sh app/modules/phonecando-terminal/android/src/test/c/run.sh`,
  `bash lre/launcher/test/run.sh`), logcat (`[phonecando-kb]`,
  `[phonecando-size]`), and `adb exec-out screencap`.

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
9. Android builds take a long time. Never rebuild unless the change
   requires it (native code, manifest, channel, version bump). Reuse what is
   in `dist/` (`./manage apk info` tells you what a file is); a failed upload
   or a copy to the phone is never a reason to rebuild
   (`./manage release <ver> --upload-only` retries from staged assets).
10. PCE work: read `pce/AGENTS.md`. The PCE is a separate Gradle build
   owned by PhoneCanDo; modularity, dependency direction and typed errors are
   quality gates.
11. CI path filters: `android.yml`, `tce.yml`, `web.yml`, `pce.yml`,
   `agents.yml`, `agent-payload.yml`, `lre.yml`, `proot.yml`, `lre-image.yml`
   and `lre-compat.yml` run only for the `paths:` they list. When a change gives
   a build or check a new input (the app importing a new folder, a CI script
   reading a new file, a new packaged asset), add that path to the matching
   lists in the same change. `ci`, `lint`, `security` and `codeql` run on
   everything; never filter them. The nightly runs catch what a list misses.
