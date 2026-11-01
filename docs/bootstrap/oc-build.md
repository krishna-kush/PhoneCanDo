# Building the v2 opencode payload

Produces the two native files the app ships:

| Output | What it is |
|---|---|
| `out/opencode2.bin` | opencode engine, Bun-compiled, bionic aarch64 |
| `out/libopentui.so` | TUI renderer, Zig-built, bionic aarch64 |

`scripts/bootstrap/stage-v2.sh` renames the payload to `libopencode2.so` (AGP only packages
`*.so` files) and copies both into the runner module.

## Prerequisites

All are overridable by env; none are host-specific.

- Linux host with `git`, `readelf`, `python3`.
- Bun 1.4.2 (`BUN_VERSION`, must match `BUN_COMPILE_RELEASE`).
- Android NDK r28c (`ANDROID_NDK_HOME`).
- Zig 0.16.0 (`ZIG_BIN`).
- Upstream checkout at a pair-era tag (`OPENCODE_WORKTREE`, e.g. v2.0.26).
- Disk-backed workdir, not tmpfs: ~15 GB free, ~2 GB RAM for the web build.

## Quickstart

```sh
WORK=/path/to/v2build
mkdir -p "$WORK"
git clone --depth 1 --branch v2.0.26 \
  https://github.com/anomalyco/opencode.git "$WORK/oc-v2"

export ANDROID_NDK_HOME=/path/to/android-ndk-r28c
export ZIG_BIN=/path/to/zig

./scripts/bootstrap/build-engine-android.sh "$WORK"
./scripts/bootstrap/stage-v2.sh "$WORK/out"

pnpm -C app android:full
```

`scripts/bootstrap/build-engine-android.sh` defaults `OPENCODE_WORKTREE` to `$WORK/oc-v2`,
clones `anomalyco/opentui` at `OPENTUI_VERSION` into `$WORK/`, and writes to
`$WORK/out`.

## What the patches change

Upstream `packages/cli/script/build.ts` has no Android target; any
`--target=opencode-*-android` throws `Unknown build target`.
`scripts/bootstrap/patches/build-android-target.patch` adds:

- `{os:"linux", arch:"arm64", abi:"android"}`;
- `@opencode-ai/pty` resolve failure → `undefined` (no bionic binding; the
  caller degrades gracefully);
- `@parcel/watcher` → a throwing stub (no publishable binding; the caller
  falls back to polling).

The web UI stays on (no `--skip-web-ui`): `buildAppArchive()` compiles the
Solid app and embeds it as `opencode-web-ui.gen.ts`.

`scripts/bootstrap/patches/opentui-android-build.patch` plus driver steps handle:

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

## Verify before staging

- `readelf -d` on both files: `NEEDED` system-only (`libc`, `libm`, `libdl`).
- `strings` on the payload: `auth/connect`, `/api/pair`, `wasm-unsafe-eval`
  (embedded UI), `OPENTUI_LIB_PATH`.
- Undefined-symbol scan of `libopentui.so` against the NDK api-29 stubs: zero
  gaps. This catches the next `dlopen ... cannot locate symbol` before it
  ships.
- AGP `stripDebugDebugSymbols` shrinks both files (~60 KB payload, ~16 MB
  renderer), so APK sizes differ from `out/` by design.

`scripts/bootstrap/stage-v2.sh` runs the linkage guard and refuses non-system `NEEDED` entries.

## Device E2E

1. An old serve survives reinstalls as an orphaned native child. Kill it
   (`run-as ... kill <pid>`) or the app health-checks the stale engine.
2. `POST /api/pair` → `{code, expires_in}`; `GET /` → web app HTML.
3. App: pair WebView loads, TUI attaches and renders (renderer init must not
   throw), prompt → answer works, engine Start/Stop/Refresh healthy.

## Updating to a newer opencode

```sh
TAG=v2.0.27   # replace with the new tag; must still have the pair-era API
git -C "$WORK/oc-v2" fetch --depth 1 origin tag "$TAG"
git -C "$WORK/oc-v2" checkout "$TAG"

# The renderer must match the opencode tree's @opentui/core pin.
grep -R '"@opentui/core"' "$WORK/oc-v2" --include='package.json' | head

export OPENCODE_VERSION="${TAG#v}-android-phonecando.1"
export OPENTUI_VERSION=<version-from-that-pin>
./scripts/bootstrap/build-engine-android.sh "$WORK"
./scripts/bootstrap/stage-v2.sh "$WORK/out"
pnpm -C app android:full
```

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
- **Web UI theme:** `ChatWebScreen.themeScript` maps the app palette onto
  opencode v2's internal `--v2-*` CSS variables and writes the
  `opencode-color-scheme` key. Neither is a public API. After a bump, re-check
  `packages/ui/src/styles/tokens/theme.css` (variable names),
  `packages/ui/src/theme/v2/mapping.ts` (semantic mapping), and
  `packages/app/public/oc-theme-preload.js` (scheme key). A rename fails
  silently: the embedded UI falls back to opencode's palette.

## Troubleshooting

- **Patch already applied:** the driver applies patches idempotently; the
  message is expected on reruns.
- **`resolveNativeLibraryPath` anchor missing:** the `@opentui/core` chunk
  changed; update the anchor in `scripts/bootstrap/build-engine-android.sh`.
- **`pthread_tryjoin_np` at dlopen:** the opentui patch did not apply; check
  `git -C "$OPENTUI_SRC" status`.
- **Zig can't find headers:** confirm `ANDROID_NDK_HOME` points at r28c and
  `ANDROID_API=29` (default).
