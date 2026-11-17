# Building the v2 opencode payload

Produces the two native files the app ships:

| Output | What it is |
|---|---|
| `out/opencode2.bin` | opencode engine, Bun-compiled, bionic aarch64 |
| `out/libopentui.so` | TUI renderer, Zig-built, bionic aarch64 |

`agents/kit/native/stage.mjs` copies both into the runner module as
`liboc-engine.so` and `liboc-opentui.so`, as `payload.libs` in
`agents/native/opencode/agent.json` names them (AGP only packages `*.so`
files; `oc-` marks them as opencode's next to other agents' engines).

## Prerequisites

The versions are pinned in `agents/native/opencode/build/pins.env`. All are
overridable by env; none are host-specific.

- Linux host with `git`, `readelf`, `python3`.
- Bun 1.4.2 (`BUN_VERSION`, must match `BUN_COMPILE_RELEASE`).
- Android NDK r28c (`ANDROID_NDK_HOME`).
- Zig 0.16.0 (`ZIG_BIN`).
- Upstream checkout at a pair-era tag (`OPENCODE_WORKTREE`, e.g. v2.0.26).
- Disk-backed workdir, not tmpfs: ~15 GB free, ~2 GB RAM for the web build.

## Quickstart

Most of the time you don't build it: `./manage agent sync` stages CI's build of
these pins (agent-payload.yml, kept 14 days). To build it here:

```sh
export ANDROID_NDK_HOME=/path/to/android-ndk-r28c
export ZIG_BIN=/path/to/zig

./manage agent opencode build --stage

pnpm -C app android:full
```

That is `agents/kit/native/build.mjs`: `ci/sources.sh` clones the pinned
upstream trees into the workdir (`dist/agents/opencode/<INPUTS>/`, one per set
of sources), `build/build.sh` builds into its `out/` with the pins' INPUTS
beside the files, and `--stage` stages them stamped
(`agents/kit/native/stage.mjs`). A build of the same sources is found again
and not redone (`--force` redoes it).

By hand, the same build is:

```sh
WORK=/path/to/v2build
git clone --depth 1 --branch v2.0.26 \
  https://github.com/anomalyco/opencode.git "$WORK/oc-v2"
./agents/native/opencode/build/build.sh "$WORK"
```

`build/build.sh` defaults `OPENCODE_WORKTREE` to `$WORK/oc-v2`, clones
`anomalyco/opentui` at `OPENTUI_VERSION` into `$WORK/`, and writes to
`$WORK/out`. Its output carries no INPUTS, so a payload staged from it counts
as outdated until it is built through the kit.

## What the patches change

Upstream `packages/cli/script/build.ts` has no Android target; any
`--target=opencode-*-android` throws `Unknown build target`.
`agents/native/opencode/build/patches/build-android-target.patch` adds:

- `{os:"linux", arch:"arm64", abi:"android"}`;
- `@opencode-ai/pty` resolve failure → `undefined` (no bionic binding; the
  caller degrades gracefully);
- `@parcel/watcher` → a throwing stub (no publishable binding; the caller
  falls back to polling).

The web UI stays on (no `--skip-web-ui`): `buildAppArchive()` compiles the
Solid app and embeds it as `opencode-web-ui.gen.ts`.

`agents/native/opencode/build/patches/opentui-android-build.patch` plus driver steps handle:

- NDK sysroot copied into the workdir, with clang nullability annotations
  stripped (`_Nullable`/`_Nonnull`/`_Null_unspecified`); zig translate-c
  chokes on them in array bounds. The annotations are ABI-neutral.
- `zig-deps` vendored via `scripts/prepare-zig-deps.sh` (missing from a fresh
  clone breaks the build).
- `zig build --libc <bionic-libc.txt>` covers includes/CRT. Zig 0.16 does not
  search the sysroot for `-ldl`/`-lm`, so `build.zig` adds the NDK API-level
  lib dir for Android.
- bionic has no `libpthread` (symbols live in libc), so it is not linked.
- bionic lacks `pthread_tryjoin_np` (referenced by
  `src/clipboard/host.zig`), which fails the whole-library `dlopen`; the patch
  ships `src/android-pthread-shim.c` (kill+join, never blocks).
- `@opentui/core` ≥ 0.5.15 rejects `process.platform === "android"` and
  dropped the `OPENTUI_LIB_PATH` override. The driver restores the env
  short-circuit in the bundled chunk before compiling.

### PhoneCanDo's brand

The web UI and TUI show PHONECANDO, our name, where they showed opencode's.
The credit stays visible: the web UI's About page says "Built on OpenCode,
the open source coding agent by Anomaly" and that we are not affiliated,
above OpenCode's own credits, trademark line and third-party notices, which
we keep. OpenCode's brand page (opencode.ai/brand) asks projects built on it
to lead with their own name and never to suggest Anomaly endorses them.

- `patches/phonecando-brand.patch`:
  - the web wordmarks (`ui/src/components/logo.tsx`,
    `ui/src/typography/wordmark/wordmark.tsx`, the About page's animated
    one) as PHONECANDO in square letters with our mark's hard drop shadow;
  - the new-session screen's big wordmark (`app/src/new-session/`) in our
    colours, solid on a light page and at 85% on a dark one
    (`--wordmark-opacity`): PHONE and DO in our primary red, CAN in our
    secondary yellow, the shadow the theme's weak icon colour. `<Logo>`
    fills its three words from `--logo-phone`, `--logo-can` and `--logo-do`,
    which only `wordmark.css` sets, from the two vars our app writes on
    `:root` (agent.json's `cssVars`: `--phonecando-brand-primary` and
    `--phonecando-brand-secondary`); the shimmer sets them to white, so its
    sweep stays light. Every other web wordmark and the error page's
    `<Logo>` keep the theme's icon colours, and so does this one when the
    page runs without our app;
  - the page title and manifest name;
  - the About page's built-on line (`settings.about.builtOn`, en only; other
    languages fall back to it);
  - the TUI logo (`tui/src/logo.ts`, PHONE beside or over CANDO;
    `component/logo.tsx` stacks them under 54 columns, the exit footer
    under 51), PHONE and DO in the theme's first agent colour and CAN in
    its second (our red and yellow in our theme);
  - the TUI's theme: `phonecando` (below) unless you pick another
    (`context/theme.tsx`; until its file is read, or without one,
    opencode's is drawn);
  - the terminal title, the crash headline, and "Tell PhoneCanDo what to do
    differently". The `OC |` prefix of a chat's title stays: agent.json's
    `chatTitle` reads it.
- `brand/rename.mjs` renames OpenCode to PhoneCanDo in the locale strings
  that name the app itself (its `KEYS`), in every language. It is a script
  because those strings are in 63 files. It fails when upstream drops or
  rewords one of its keys; `ci/upstream.sh` runs it with `--check`.
- `brand/icons/`, written by `scripts/make-logos.mjs` (`pnpm logos`): our
  mark over the upstream desktop icon set that `packages/app/vite.icons.ts`
  reads for the favicon and install icons. All are on a transparent
  background, so a change to our theme's background never changes these
  build sources (and so the payload).
- The TUI theme itself is not in the payload: the agent's config ships it
  (`config/themes/phonecando.json`, into `.config/opencode/themes/`), so
  a colour change needs an app build, never a payload build. It is
  opencode's own default theme (a copy in `scripts/tui-theme/opencode.json`,
  MIT) with its two main colours made ours by `scripts/make-tui-theme.mjs`
  (`pnpm tui-theme`) from `theme/tokens.json`: interactive (the active
  input, selections, links) our red, the accent (headings, highlights) and
  warning (a command waiting for your OK) our yellow, and agents' colours
  starting with those two, so Build is red. Every other colour stays
  opencode's. On a pin bump, copy that version's
  `packages/tui/src/theme/assets/v2/opencode.json` over the copy and run it
  again.

What stays upstream's, on purpose:

- **Names that are true as they stand.** OpenCode Zen, Go and Console are
  their services. "Free models provided by OpenCode" is true. Lines about
  an OpenCode server's version, the crash report sent to their repo, the
  model-facing prompts and commands such as `opencode pair` all stay.
- **The wire identity.** This is the `opencode/<channel>/<version>/<client>`
  User-Agent, the `x-opencode-*` headers, `OPENCODE_CLIENT`, the provider ids
  and the `OPENCODE_*` vars. OpenCode's free models are for OpenCode ("Free-tier
  chat models require OpenCode", opencode.ai/docs/zen). This is still OpenCode,
  and it says so; never change these to look like another client.

## Verify before staging

- `readelf -d` on both files: `NEEDED` system-only (`libc`, `libm`, `libdl`).
- `strings` on the payload: `auth/connect`, `/api/pair`, `wasm-unsafe-eval`
  (embedded UI), `OPENTUI_LIB_PATH`, `PhoneCanDo` (the brand patch's TUI).
- Undefined-symbol scan of `liboc-opentui.so` against the NDK api-29 stubs: zero
  gaps. This catches the next `dlopen ... cannot locate symbol` before it
  ships.
- AGP `stripDebugDebugSymbols` shrinks both files (~60 KB payload, ~16 MB
  renderer), so APK sizes differ from `out/` by design.

`agents/kit/native/stage.mjs` runs the linkage guard
(`agents/kit/native/verify-elf.sh linkage`): it refuses non-system `NEEDED`
entries, and an engine whose INTERP is not `/system/bin/linker64`. CI runs
the rest of the list above (`verify-elf.sh deep`, with
`agents/native/opencode/ci/verify.env`).

## Device E2E

1. An engine can survive a reinstall as an orphaned native child. Every
   engine process carries its agent's `PHONECANDO_AGENT` tag, so the next
   start of that agent's engine ends it; to clear it by hand, `run-as ...
   kill <pid>`.
2. `POST /api/pair` → `{code, expires_in}`; `GET /` → web app HTML.
3. App: pair WebView loads, TUI attaches and renders (renderer init must not
   throw), prompt → answer works, engine Start/Stop on the agent's page (Env
   tab) healthy.

## Updating to a newer opencode

`WORK` is a workdir with the upstream clone in `oc-v2/`: any folder a
`./manage agent opencode build` made under `dist/agents/opencode/`.

```sh
TAG=v2.0.27   # replace with the new tag; must still have the pair-era API
git -C "$WORK/oc-v2" fetch --depth 1 origin tag "$TAG"
git -C "$WORK/oc-v2" checkout "$TAG"

# The renderer must match the opencode tree's @opentui/core pin.
grep -R '"@opentui/core"' "$WORK/oc-v2" --include='package.json' | head

export OPENCODE_VERSION="${TAG#v}-android-phonecando.1"
export OPENTUI_VERSION=<version-from-that-pin>
./agents/native/opencode/build/build.sh "$WORK"
node agents/kit/native/stage.mjs opencode "$WORK/out"
pnpm -C app android:full
```

Values in the env win over `pins.env`, so a bump can be tried before it is
written down (a try staged this way counts as outdated: its output has no
INPUTS). Once it builds, put the new values in
`agents/native/opencode/build/pins.env`, the `version` in
`agents/native/opencode/agent.json` and the versions in these docs, then
`./manage agent opencode lock`. A patch change with no upstream bump still
needs a new version: raise the `.N` of `-android-phonecando.N` (`./manage
agent check` fails until you do);
`agents/native/opencode/ci/pins.sh` (CI's check job) names whichever was
missed.

The build and stage scripts are the automation. There is no blind
"update to latest" command: the tag has to keep the pair-era API, and the
patch hunks have to apply. The checks below are the part a script cannot
decide for you.

## Bumping versions

- **opencode:** newer `anomalyco/opencode` tag. It needs the pair-era API and
  the same `script/build.ts` shape; re-check that the patch hunks apply.
- **Renderer:** `OPENTUI_VERSION` must match the `@opentui/core` npm pin in the
  opencode tree's catalog, or the JS/ABI drifts. The failure is at runtime, not
  build time.
- **Web UI theme:** the web adapter in `agents/native/opencode/agent.json`
  (`surfaces.web.adapter`) maps the app palette onto opencode v2's internal
  `--v2-*` CSS variables (`cssVars`) and writes the `opencode-color-scheme`
  key (`colorSchemeKey`). Neither is a public API. After a bump, re-check
  `packages/ui/src/styles/tokens/theme.css` (variable names),
  `packages/ui/src/theme/v2/mapping.ts` (semantic mapping), and
  `packages/app/public/oc-theme-preload.js` (scheme key), then update the
  adapter. `ci/upstream.sh` checks the names and the key; it skips our own
  `--phonecando-*` vars, which only the brand patch reads. A rename fails
  silently: the embedded UI falls back to opencode's palette.

## Troubleshooting

- **Patch already applied:** the driver applies patches idempotently; the
  message is expected on reruns.
- **`resolveNativeLibraryPath` anchor missing:** the `@opentui/core` chunk
  changed; update the anchor in `agents/native/opencode/build/build.sh`.
- **`pthread_tryjoin_np` at dlopen:** the opentui patch did not apply; check
  `git -C "$OPENTUI_SRC" status`.
- **Zig can't find headers:** confirm `ANDROID_NDK_HOME` points at r28c and
  `ANDROID_API=29` (`pins.env`).
