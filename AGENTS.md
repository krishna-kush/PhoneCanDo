# AGENTS.md — PhoneCanDo (coding agents read this first)

On-device coding agents for Android. Each agent is one instance of an agent
kind (opencode built in; Claude Code, Gemini CLI installed into its machine)
with its own engine in the runner's foreground service: as many at once
as RAM allows (no cap unless the user sets one; the runner's memory guard
warns near the peak and stops the sleepiest itself if nobody does), each
with its own bridge token (a server engine also gets its own
loopback port and password); JS starts them through `ensureEngine.ts`.
Each agent lives in an image (a machine): VM-like Linux through proot, or
Android without Linux. A new agent gets its own (recommended) or shares
another agent's, like apps on one PC: one system, tools and projects; each
keeps its own sign-in and chats (a second agent of a kind gets its own state
folder through the kind's `state` block, or can't share), and every agent's
instructions name the others there. The machine goes with its last agent. Home is the active agent's own UI (opencode's pair-loaded
web UI, or the kind's TUI); terminals run over our JNI PTY, rendered by
xterm.js in a WebView.

Engine = the local host for one agent; opencode is the first. Each agent
kind is one folder in `agents/` named by its id; its `oc-`-style prefix is
used only where it meets other kinds' files in a flat namespace (`liboc-*.so`,
the `oc-payload-arm64` artifact). Generic seams (`app/src/engine/`,
`phonecando-runner`) never name a kind — see `docs/overview/architecture.md`.

## Layout

- `app/App.tsx`, `app/index.ts` — root (Tamagui + KeyboardProvider + SafeArea).
- `app/src/ui/{nav,drawer,chat,terminal,env,setup,settings,accessibility,models,memory,messages,schedule,recommend,account,common}/` —
  feature screens. Navigation: Home (the active agent) with a stack of
  pages over it and a side drawer, no tabs and no back arrows. The stack
  is `state/app/` (`stack.ts` pure); `nav/` draws and moves it and holds
  the one Back handler (`useBackChain.ts`). `drawer/` is the side menu,
  opened from Home's header. `common/face/` is A-01, the site's mascot, as
  each agent's face, in the agent's own mascot (`state/mascots.ts`, changed
  on its Mascot page, `env/agent/mascot/`). `models/` is the Models page and
  a model's own page (`model/`); an agent's Model page is in `env/agent/`. `memory/` is the
  RAM warning (sheet, Home chip, pill, auto-stop line; pure copy and rows
  in `memory/logic/`), mounted once
  over every page. `messages/` is the Messages page (what agents send each
  other, the screen queue), the drawer's unread marks and an agent page's
  Messages and wake rows; pure parts in `messages/logic/`.
  `schedule/` is the Schedules page (tasks set to reach an agent at a time,
  the recent runs, its editor in `editor/`), the drawer row and an agent
  page's Schedules and "Can schedule itself" rows; pure parts in
  `schedule/logic/`.
  `recommend/` is telling a friend: the Refer page (Settings' Tell a friend
  row: Share, then what each link did), the "Having fun?" card at Home's
  foot after a run finished in front of you, and the listener for a
  friend's link opening the app (`copy.ts`, `logic/funnel.ts` pure; when
  it asks is `state/logic/recommendAsk.ts`; links and codes are
  `state/logic/share/`). `account/` is the optional Google sign-in's
  Account page (`copy.ts` pure; what is coming next, also optional, is
  `COMING` there and in `docs/planning/todo.md`) and `useSettingsSync.ts`,
  mounted once in `App.tsx`: a signed-in person's settings follow them
  (`state/flows/settingsSync.ts`, pure keys and merge in
  `state/logic/settingsSync/`).
  `accessibility/` is the whole Accessibility setup guide: `guide.ts`
  (pure: the `RESTRICTED_FLOW` switch, steps and every line of copy), the
  hook, the step list, the Settings block and the agent's dialog.
  Terminal split: `TerminalScreen.tsx` (session shell) + `TerminalView.tsx`
  (the IME, mirror, sizing and spacer; used by a terminal page and by a
  TUI-home agent's Home) + `transport/` (local PTY or the engine's hosted
  PTY) + `theme/` (the app's scheme: colours, what programs are told) +
  `keys.ts`, `reconcile.ts`, `sizing.ts` (pure, zero RN imports) +
  `usePtySession.ts`, `useMirrorInput.ts`, `useInitialInput.ts`,
  `useViewFocus.ts` (hooks) + `sessionRecipe.ts` (agent TUI client or
  image shell) + `ExtraKeysBar.tsx`, `FolderPicker.tsx`. Home (`chat/HomeScreen.tsx`) is the kind's web UI or,
  for a TUI-style kind, its TUI (`chat/tui/`).
  `env/` holds the agent pages (`agent/`), New agent (`new-agent/`;
  `new-env/` downloads a Linux), Systems (`list/`) and Custom agents
  (`custom-agents/`); pure parts in `env/logic/`. `setup/` is first
  launch (the first agent and its machine). Settings and About are
  app-wide only: Phone control sits on Settings itself, then a hub of rows
  (`settings/logic/hub.ts`), each opening its own page (`settings/pages/`),
  the run caps among them.
- `app/src/engine/` — the ONLY importer of native modules (`terminal.ts`
  PTY transport, `runner.ts` engine host, `linux/native.ts` Linux runtime,
  `models/native.ts` local models, `files.ts` file system, `auth.ts`
  biometrics, `backGesture.ts` the back gesture's progress, `memory.ts` the
  memory guard's reading, `runLimits.ts` the run caps, `keepRunning.ts` an
  agent's Keep running, `splash.ts` the launch splash, `pick.ts` Android's
  date and time dialogs). Agents and engines:
  `engines.ts`, `ensureEngine.ts`, `connection.ts`; agent kinds through
  `agents/registry.ts` (each kind's `KindView`, from the runner's
  `listKinds`), `agents/webAdapter.ts`, `agents/records.ts` and
  `agents/user/` (the user's own kinds); `sharing.ts` (clipboard, share
  sheet); `messages/` agent messages (the log, unread counts, the screen
  queue, the wake switch); `schedule/` schedules (the list, the runs log,
  exact alarms, "Can schedule itself"); `apiHost.ts` our API host; `account/` the
  optional Google sign-in (`modules/phonecando-account`; the session token
  stays native); `share/` share links' counts and codes' random bytes.
  Screens stay dumb.
- `theme/tokens.json` — the ONLY palette (dark + light, web-sourced). Web
  (`Base.astro`) and app (`globals/theme.ts`, `tamagui.config.ts`) read it
  directly; never hardcode a theme colour on either side. Brand/favicon
  assets are generated from it by `scripts/make-logos.mjs` (`pnpm logos`);
  native icon changes need `expo run:android`. `theme/logo.json` is the one
  shadow + loader spec: web CSS is generated from it in
  `web/src/lib/logoLoaderCss.ts`; the app imports it directly.
- `mascot/` — the A-series mascots' one spec (own package, pure TS, zero
  deps), built on `theme/logo.json`: the body and its five shapes
  (`body.ts`), the parts a unit wears (`parts/{hat,neck,face}/`, a file
  each), the designs (`designs.ts`: a new design is a line), random picks
  (`pick.ts`) and the layout every side draws from (`layout/figure.ts`:
  blocks, eyes and marks, face on, side on or from behind; `layout/path.ts`
  SVG paths). The site's cards, backdrop and `/mascots` page and the app's
  faces (`ui/common/face/`) draw from it. `node --test
  "mascot/test/*.test.mjs"`.
- `app/src/state/` — zustand stores: `app.ts` (navigation, prefs and
  telemetry slices in `app/`), `agents.ts` (agents, engine states, the
  active agent), `linux.ts` (envs, images, job progress), `models.ts`
  (local models, downloads, job progress), `kinds.ts` (the user's own
  kinds), `memory.ts` (the memory guard's reading, the warning's
  episode), `messages.ts` (unread counts, the message log, the screen
  queue), `schedule.ts` (the schedules, their runs, exact alarms),
  `keyboard.ts` (keyboard open; the per-frame room is a UI-thread
  value in `ui/common/keyboard/room.ts`), `recommend.ts` (the "Having
  fun?" card's runs, last ask and answer), `share.ts` (the links this
  phone shared, what they did), `account.ts` (who is signed in),
  `settingsSync.ts` (when each synced setting last changed here),
  `mascots.ts` (each agent's mascot, picked at random); multi-step
  flows in `flows/` (pure parts in `flows/logic/`). Ports, passwords and tokens stay
  native, never in JS state.
- `app/modules/{phonecando-terminal,phonecando-runner,phonecando-linux,phonecando-models,phonecando-back-gesture,phonecando-network,phonecando-account}/` —
  own Expo modules (Kotlin + TS shims, clean-room). The PTY's plain POSIX
  core is `phonecando-terminal/android/src/main/cpp/pty/` (`forkpty.c` is the
  JNI glue). `phonecando-linux` is the Linux runtime's Android host (env and
  image records, jobs, setup/reset/delete, terminal recipes, the Docker Hub
  catalog) and packages the launcher and the staged proot libs and Default
  image (full and lite only; play refuses every Linux path). Its
  `src/linux/dev-assets/` holds a local, unlocked image for debug variants
  only (`./manage image stage --local`). `phonecando-models` is the local
  models' Android host (lme's ModelStore over `files/models/`, Hugging Face,
  download and import jobs, the HF token in Keystore) and packages
  `libllama-server.so` on every channel (staged by `lme/llamacpp/stage.sh`);
  the runner's model servers (`runner/models/`, one per loaded model, shared
  by its agents; `LocalModelBinding.kt` the one join) serve a model to an
  agent. `phonecando-back-gesture` runs the
  back gesture's steps on the UI thread while a page or the drawer is open
  and tells JS the commit (optional: without it Back still works).
  `phonecando-account` is the optional Google sign-in (Credential Manager,
  needs Google Play services; the session token sealed in Keystore, never
  in JS; it calls only our `/v1/account` routes). Never Termux code in our own
  modules; programs we ship as-is (opencode, proot from the termux fork) are
  third-party payloads with their own licenses, built from pinned sources.
  The runner packages every agent kind from `agents/` (`agents.gradle`:
  assets `agents/<id>/`, per-channel staged libs in
  `src/agents/<id>/libs/`) and never names a kind; `KindCatalog` reads
  the packaged manifests and binds `BuiltinHooks`. The runner's `engine/`
  is the supervisor (the user's optional cap with LRU idle stop,
  tagged-process reaper; `engine/work/` tells the jobs an agent left
  running from the agent and stops idle agents with none in the
  background unless kept running or asked to stay up (`KeepAsks`, the
  `agents_keep_running` tool), pure `AgentWork` and `ReclaimPolicy`),
  `limits/` the run
  caps, `memory/` the memory guard (pure `MemoryPolicy`, numbers in
  `MemoryRules`), `jobs/` the jobs anchor (keeps the `specialUse` service
  up while model and Linux jobs run), `power/` the wake lock while work
  runs, `bridge/` the loopback bridge (per-agent tokens, prompts, screen
  lease).
  `messages/` is agent-to-agent messaging (the `agents_*` tools' routes:
  who's here, send, inbox, wait; the log in `files/state/`; delivery
  into each agent's inbox folder or its own server by its manifest's
  `inbox` block; waking idle agents; the screen queue's notices).
  `schedule/` is Schedules (the `schedule_*` tools' routes and the app's;
  `files/state/schedules.json` and the runs log; one AlarmManager alarm,
  exact when allowed; at a task's time it starts the agent with the task
  as its first prompt (the manifest's `engine.prompt`), wakes it or asks
  you; pure `NextRun`, `DueRules`, `FireRules`, numbers in `ScheduleRules`).
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
  hooks are registered), `shared/phone-tools/` (the `mobile_*` and
  `agents_*` tools). Each kind's `agent.json`
  drives packaging, CI matrices, the APK audit, the website's agent cards
  and which kind is the default (`"default": true` on at most one bundled
  kind: the app's first agent and the site's built-in card). Pure-JVM Gradle build
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
  line in `docs/telemetry.md`. Share links (`/i/<code>`, `/v1/share/stats`)
  are tce too.
- `accounts/` — optional Google sign-in's server (own pnpm package, zero
  runtime deps): checks Google ID tokens, sessions, the share-link list and
  the synced settings a signed-in person keeps; own D1 `phonecando-accounts`, never joined with
  usage stats. The tce Worker mounts its one entry
  (`accounts/hosts/cloudflare/index.ts`). Read `accounts/AGENTS.md`; the
  published schema is `docs/accounts.md`.
- `lme/` — local model engine: finds, fetches and checks GGUF weights and
  plans the llama.cpp server that serves them on loopback; read
  `lme/AGENTS.md`, docs in `lme/docs/README.md`, work in
  `lme/docs/planning/todo.md`. Pure-JVM Gradle build (`cd lme && ./gradlew
  build`): api ← gguf, api ← catalog, api + gguf ← store, api ← host,
  gguf + host ← cli (lme-cli, for CI); catalog's tests also use host
  (no android.*, no org.json; it never
  imports `agents/` and `agents/` never imports it). Our suggested models,
  best first, with the phone RAM each needs, are catalog's
  `suggested/suggested.json` resource: the app reads it as
  `Suggested.MODELS` and the website imports it (`SuggestedRamTest` keeps
  its RAM in step with `RamRules`). `lme/llamacpp/` builds
  `libllama-server.so` from pinned sources (`pins.env`) and our
  `patches/`, stages it into `phonecando-models`, and `build-host.sh`
  builds it for Linux for CI's local-model check (`local-models.yml`).
- `network/` — our one way to the network, shared by every engine that
  downloads (lme's models, lre's Linux images): pure-JVM Gradle build
  (`cd network && ./gradlew build`, `network.yml`): `http` (the port, our
  redirect rules, `errorFor`: a CDN's 401/403 retries, a 429 waits as long
  as `RateLimit`/`Retry-After` ask), `download` (resumable sha256-verified
  downloads, hash checkpoints, a pause that cuts a hanging read) and
  `retry` (when to try again, waiting out no network, `ResumeList`), with
  http ← download, http ← retry. It throws `NetException`; each engine maps
  it to its own errors at its edge and keeps it as the cause. No engine
  types, no android.*. lme and lre include it (`includeBuild("../network")`),
  the app too (`withNetworkCompositeBuild.js`). Its one Android piece,
  whether the phone is online, is `app/modules/phonecando-network`
  (`NetworkState`, no JS). Never copy network code into an engine.

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
  Prebuild runs with `--no-clean` (Expo CLI otherwise deletes and
  regenerates `app/android`), so `app/android` and its compiled outputs
  survive; pass `--clean` to `pnpm android:<channel>` / `./manage build` only
  when a build looks stale.
- New JS native-module imports: restart Metro with `--clear` (stale haste
  map fails "Unable to resolve"). `adb reverse tcp:8081 tcp:8081`.
- Tamagui 3 compiles inside Metro (`withTamagui` in `app/metro.config.js`,
  no Babel plugin) and misses `tamagui.config.ts` edits: `rm -rf
  node_modules/.cache/tamagui` and restart Metro with `--clear`. Style props
  take bare names (`gap="2"`, `color="color10"`, `fontFamily="mono"`), never
  `$`; `npx tamagui check` (in `app/`) checks them. Colours on Tamagui
  props are palette roles by name (`color="dim"`), never a `useTheme()`
  value (that keeps the compiler from flattening the element).
- Verify with `tsc --noEmit`, `pnpm check:vectors`, the host C tests
  (`sh app/modules/phonecando-terminal/android/src/test/c/run.sh`,
  `bash lre/launcher/test/run.sh`), logcat (`[phonecando-kb]`,
  `[phonecando-size]`), and `adb exec-out screencap`.

## Rules

1. Evidence before synthesis: read files, run code, screenshot. Never ship
   a sizing/layout claim without pixels or logs.
2. No per-device numbers: cells from xterm runtime, keyboard from live
   native height, backgrounds matched to the TUI (the scheme's `termBg`:
   `#0a0a0a` dark, white light), not `#000`.
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
7. One concern per commit-sized change. The base commit gets amended as
   work lands — check `git log`/`git show HEAD` before assuming what HEAD
   contains.
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
   `agents.yml`, `agent-payload.yml`, `lre.yml`, `proot.yml`, `lre-image.yml`,
   `lre-compat.yml`, `lme.yml`, `llamacpp.yml`, `local-models.yml`,
   `network.yml`, `accounts.yml` and `suggested-models.yml` run only for the `paths:` they list. When a change gives a build or check a
   new input (the app importing a new folder, a CI script
   reading a new file, a new packaged asset), add that path to the matching
   lists in the same change. `ci`, `lint`, `security` and `codeql` run on
   everything; never filter them. The nightly runs catch what a list misses.
