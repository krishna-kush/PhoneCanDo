# Bootstrap — build the opencode payload

The app ships ~200 MB of native payload that is not in git. The scripts in
`scripts/bootstrap/` build it; this page is the docs entry.

- `libopencode2.so` — the opencode engine (Bun, bionic aarch64);
- `libopentui.so` — the TUI renderer (Zig, bionic aarch64).

The app build does **not** build the payload. Stage the payload first, then
build the app.

## Quickstart

Prerequisites: Linux host, Bun 1.4.2, Android NDK r28c, Zig 0.16, git, ~15 GB
disk, ~2 GB RAM.

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

`scripts/bootstrap/stage-v2.sh` writes to
`app/modules/phonecando-runner/android/src/main/libs/arm64-v8a/`.

## Why self-built

Building from upstream keeps opencode current and embeds the web UI and pair
API the app's home tab needs. The build is reproducible from upstream opencode,
Bun, Zig and the NDK; no prebuilt runtime is involved.

## Updating

Change the clone tag, then rerun the same build, stage and app steps. See
`oc-build.md` → Bumping versions for the patch, opentui and web-UI theme
checks that a new tag needs.
