# Project context

Hard-won findings. Read before touching the related code.

## Engine and runtime

### bionic opencode engine
The engine is a Bun binary built for Android arm64 with the web UI embedded;
it runs on bionic with system libs only. `opencode serve` is headless-first-
class; the TUI drives the same server.

### exec wall → jniLibs
Android 16/targetSdk 36 denies `execute_no_trans` on app-data files. Ship the
engine as `jniLibs` (`nativeLibraryDir` permits exec) and execute it directly.
Manual `run-as` exec works; service-context exec does not — always test via
service.

### AGP drops non-`.so` jniLibs silently
Only `*.so` names are packaged. The build output (`opencode2.bin`) is staged as
`libopencode2.so`, next to `libopentui.so`. Verify with
`unzip -l app-debug.apk | grep lib/arm64`.

### `extractNativeLibs=true` required
Expo defaults it off → `lib/arm64/` empty on device. Config plugin
`app/plugins/withExtractNativeLibs.js`. Verify on-device dir listing, not just
APK contents.

### Expo Go is out, prebuild is in
No custom native code runs in Expo Go. Path: prebuild + dev-client APKs, local
modules + config plugins, CNG (`app/android/` gitignored, never hand-edited).
Run `expo install --check/--fix` after EVERY dep change (15.0.8-vs-core
`AnyTypeProvider` boot crash).

### ghost sockets + stale serves
Match native processes by the engine library name (`libopencode2.so`), never
the bare `opencode`. A dead serve can leave an ownerless LISTEN socket (only
reboot clears). Never `adb reverse` the engine port; forward only. The service
owns/persists/picks a free port; the app adopts it via `getServePort`.

### projects, not envs
Directory isolation = PROJECT (folder + chats). ENV is reserved for future hard
isolation (own HOME/auth/serve). `attach --dir` enforces scoping.

## Terminal and chat

The IME, sizing and keyboard contracts are implemented in
`modules/terminal.md`; the chat WebView keyboard wrapper and theme script
are in `modules/chat.md`. The non-negotiables:

- A hidden RN `TextInput` owns the IME and mirrors the TUI's current line;
  every text-inserting path is folded into the shadow. Never WebView stdin —
  PTY bytes are irreversible.
- The xterm page's pixels are the sizing truth; RN applies the result to xterm
  and the PTY. Use the TUI background (`#0a0a0a`), never `#000`.
- The keyboard spacer uses live keyboard height, not `keyboardDidShow`; the
  input is an absolute 1x1 overlay; never `visible-password`.

## Theme

`theme/tokens.json` is the only palette; web and app read it directly, so they
cannot drift. The terminal canvas stays `#0a0a0a`; chat's `themeScript` maps
the palette onto opencode's `--v2-*` vars (see `modules/chat.md`).

## Related

- Module docs: `modules/runner.md`, `modules/terminal.md`,
  `modules/chat.md`
- Current limits: `../../docs/release/known-limits.md`
