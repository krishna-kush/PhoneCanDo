# Agents rules: read before touching `agents/`

`agents/` holds every coding-agent kind PhoneCanDo can run, along with the
kit for writing one. We and outside vendors (by PR) add kinds here. The
app reaches them only through its seams; nothing in this folder knows about
the app, Android or Expo. Every rule here is a quality gate, not a style
preference.

## 1. Layout

```
agents/
├── kit/            the SDK every kind builds on
│   ├── kotlin/api/     kit-api: AgentKind, KindHooks, LaunchContext/Spec, AgentConfig, HttpProbe, EngineEvent
│   ├── kotlin/manifest/ kit-manifest: the manifest model the phone reads + ManifestDecoder (strict types, user rules)
│   ├── kotlin/render/  kit-render: ManifestKind, templates, launch/client rendering, KindView
│   ├── kotlin/term/    kit-term: a TUI's output stream: SignalScanner, SignalRules, ScreenRing
│   ├── kotlin/cli/     kit-cli: render-install for CI (a leaf; ships nowhere)
│   ├── ts/contract/    the TS view types the app reads (KindView, web adapter, PTY recipe; import type only)
│   ├── ts/manifest/    manifest types, rules + validate.ts (pure, zero imports; the one full validator),
│   │                   runtime-plugin.ts (the runtime.json validator)
│   ├── schema/         agent.schema.json, runtime.schema.json + valid/invalid fixtures
│   ├── scripts/        phonecando-event, phonecando-open: POSIX sh a kind's hooks call in the guest
│   ├── native/         stage.mjs (stage a payload by its manifest), verify-elf.sh
│   └── cli/            check, list (CI matrices), new (scaffolds), manifests loader, check-deps
├── builtin/        the ONLY place code hooks are registered (Kotlin BuiltinHooks)
├── shared/         kind-neutral code packaged into kinds (phone-tools/ + part.json)
├── runtimes/<id>/  runtime plugins (runtime.json + install scripts): installed only into a machine whose agent needs them
├── native/<id>/    built by us for Android, staged into the APK lib dir, runs outside proot
└── image/<id>/     installed into its machine's image when the agent is made, runs in proot; data only
```

A kind is one folder. Its name equals the manifest `id`, and it holds
everything about that kind:
- `agent.json`
- `NOTICE.md`
- config assets
- native only: `build/` (build.sh, pins.env, patches) and `ci/`
- optional `kotlin/` hooks
- docs

An image kind with no code has exactly the shape a user-added agent has.

## 2. The manifest is the source of truth

`agent.json` (schema `kit/schema/agent.schema.json`, validator
`kit/ts/manifest/validate.ts`) drives:

- packaging: `app/modules/phonecando-runner/android/agents.gradle` syncs
  `assets/agents/<id>/` per channel and adds `src/agents/<id>/libs` to the
  jniLibs of each channel the manifest lists
- staging: `kit/native/stage.mjs` copies `payload.libs[].from` to `name`
  and checks linkage
- CI: `kit/cli/list.mjs --matrix` feeds `agent-payload.yml`
- the APK audit (`scripts/apk-audit.mjs`, `.github/ci/android/audit-apk.mjs`):
  listed libs and configs present, unlisted ones absent

Never hardcode a kind's lib, asset or config name anywhere else; read the
manifest. Run `node kit/cli/check.mjs` after any manifest change.

## 3. Dependency law

```
kit-api                       (Kotlin stdlib only)
kit-api <- kit-manifest <- kit-render       (kotlinx-serialization-json; kit-render also uses kit-api)
kit-api, kit-manifest <- kit-term           (beside kit-render, never on it)
kit-* <- kit-cli              (a leaf for CI: nothing depends on it, never published)
kit-* <- <kind>               (compileOnly org.json is the one exception, for opencode)
every <kind> <- builtin
phonecando-runner <- kit-api, kit-manifest, kit-render, kit-term, builtin       (never a <kind>)
```

- No `android.*`, `androidx`, Expo, React Native or `com.phonecando.runner`
  types anywhere in `agents/`. No kind depends on another kind.
- Kinds and `builtin` have no TS: the app reads a kind as a `KindView`
  from the runner (`kit/ts/contract/view.ts`). The TS the app bundles is
  `kit/ts` only:
  - zero bare specifiers;
  - every relative import ends in `.ts`;
  - `contract` and `manifest` don't import each other.
- Outside `agents/`:
  - `app/src/**` imports `kit/ts/contract` with `import type` only;
  - only `app/src/engine/**` may import `kit/ts/manifest`;
  - nothing imports `native/**`, `image/**` or `builtin/**`; call their
    scripts by path.
- `kit/cli/check-deps.mjs` enforces all of this; `pnpm -C agents check`
  runs it.

## 4. Engine styles

`engine.style` says how the runner hosts a kind's engine
(`app/docs/modules/runner.md` → Engines):

- **server**: a loopback HTTP server on its own port. It needs
  `readiness.http`; `auth`, `events[].sse` (with its parser hook),
  `chats.title` and a web Home are server-only.
- **tui**: the kind's own TUI on a PTY the runner keeps. It runs on when
  you leave the tab or the app, its screen comes back when you return, and
  the Home tab shows it. It has no port, so none of the server blocks.
  - `readiness`: `output {settleMs, timeoutSec}` (ready after its first
    output and then that much quiet; the default, 400 ms and 60 s) or
    `alive {ms}` (ready after running that long, default 1 s).
  - `events[].pty.rules[]`: `on` (`bel`, `osc9`, `osc777`, `progress`),
    an optional `match` regex searched in the signal's text (OSC 9: after
    `9;`; progress: after `9;4;`, `state;value`; OSC 777: after
    `777;notify;`) and the `event` it raises (`working`, `waiting`,
    `finished`, `failed`). The first rule that fits wins.
  - `surfaces.chatTitle`: a regex whose group 1 is the chat title in the
    window title (OSC 0/2); it names the TUI's one chat in the service
    notification.
  - `idle.from` may hold `output`: quiet means no PTY output.
  - Exit 0 is a stop; any other exit is a death.
- Both styles: `launch.cwd` (a TUI runs there, `{{projectDir}}` is HOME; a
  server always runs in HOME) and `resume {args, at?}`, the args added
  (at argv index `at`, else at the end) when the agent's engine ran
  before.

### Image kinds

- `type: "image"` needs `requires.linux: "required"`. Its argv[0] is a
  guest command or an absolute guest path, run inside the agent's image as
  `<image>/shims/sh -c 'cd <cwd> || exit; [PATH=<runtime paths>:$PATH;
  export PATH;] exec "$0" "$@"' <argv…>` (kit-render `ImageLaunch`), with
  guest paths only:
  `{{home}}` and `{{projectDir}}` are `/root`, `{{tmp}}` is `/tmp`.
- `install` puts it in the agent's machine before the agent starts
  (kit-render `InstallRenderer`, one `sh -s` script per package family),
  in this order:
  1. each runtime in `requires.runtimes` (`<id>` or `<id>>=<major>`, a
     plugin in `runtimes/<id>/`), skipped when its check already passes;
  2. `install.packages` for the image's family (`*` the fallback);
  3. `install.steps` (POSIX sh, HOME the image home; `{{home}}` only), each
     in its own subshell with `set -e`, so a `cd`, a variable or an `exit`
     ends with it;
  4. `versionCheck` (group 1 of its pattern is the version recorded).
- `install.families`, when set, must be ones every runtime installs on.
  `update.steps` runs the same way on an installed kind.
- Retries: a mobile network drops DNS and connections now and then, so
  each runtime script, the packages and each step run again when they
  fail, up to `install.retries` more times (0 to 5, default 2), after an
  `@retry <phase> <n>/<max>` line and a wait of 5 s times the failed
  attempt. `versionCheck` runs once.
- A tui kind's own hooks raise events with `phonecando-event <name>`,
  which `events[].hook.map` maps to an engine event.

### User-added kinds

Origin `user`, stored at `files/state/agent-kinds/user/<id>.json` on the
phone (at most 64 KiB): an image kind with a `tui` engine and a `user.`
id, with no hooks, payload, packaged config (`config.dir`, `overlay`,
`shared`) or web surface. The runner checks this itself (kit-manifest
`UserRules`) and leaves out, and logs, a kind that breaks it.

## 5. Naming

- The folder is the id. The manifest `prefix` (opencode: `oc`) is used only
  where a kind's files share a flat namespace with other kinds': libs are
  `lib<prefix>-<role>.so` (`lib<prefix>-engine.so` required), and the CI
  artifact is `<prefix>-payload-arm64`. Inside the folder, files carry no
  prefix.
- Reserved prefixes: `phonecando`, `proot`, `llama`. Reserved ids: `new`,
  `list`, `check`, `kit`, `runtimes`, `shared` (assets/agents/<id>/ would
  collide). Prefixes and ids are unique. A runtime's folder is its id too.
- Upstream names stay frozen (`opencode.json`, `OPENCODE_*`,
  `~/.config/opencode/`).

## 6. Licences

- A native kind is redistributed by us: `licence.redistributed: true`, a
  `NOTICE.md`, and pinned sources in `build/pins.env`.
- A kind whose terms forbid modified or bundled copies (Claude Code, for
  example) is image-only. It is installed unmodified from the vendor at the
  user's request.
- Shipped notices also go in `THIRD_PARTY_NOTICES.md` and
  `app/src/ui/common/licenses.ts`.

## 7. Adding a kind

1. `./manage agent new <id> --native|--image` scaffolds the folder.
2. Fill in `agent.json` and `NOTICE.md`. For image kinds, that is the
   install block: the runtimes it needs (`requires.runtimes`; a new runtime
   is its own plugin in `runtimes/<id>/`, which depends on no kind and no
   other runtime), the packages per family, the steps, `update` and
   `versionCheck`; `kit-cli render-install` prints the script the phone
   runs. Steps and runtime scripts may run again (retries), so make each
   one safe to rerun from wherever the last try stopped: `mkdir -p`,
   `rm -f`, download to a file and then run it, and never append to a file
   a rerun would append to again. For native kinds, add `build/` and `ci/`.
3. Add code hooks only when data can't say it. Register them with one line
   each in `builtin/kotlin/.../BuiltinHooks.kt`.
4. Run `./manage agent check`, `cd agents && ./gradlew build` and
   `pnpm -C agents check`. For native kinds, also run
   `./manage agent <id> build|stage`.
5. CI path filters (repo `AGENTS.md` rule 11) already cover `agents/**`
   through `agents.yml`, `agent-payload.yml` and `android.yml`. A new input
   outside `agents/` needs its own filter line.

## 8. Verify

- `cd agents && ./gradlew build`: kit, hooks, kinds' JVM tests.
- `pnpm -C agents check`: typecheck, the dependency law, node tests.
- `node kit/cli/check.mjs`: kind and runtime manifests and folder rules.
- `pnpm -C app exec tsc --noEmit` and `pnpm check:vectors`: the app side.
