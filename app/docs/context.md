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
The same holds for everything a Linux image runs: our launcher, proot and its
loader ship as `lib*.so` in `nativeLibraryDir`. Manual `run-as` exec works;
service-context exec does not — always test via service.

### AGP drops non-`.so` jniLibs silently
Only `*.so` names are packaged. The build output (`opencode2.bin`) is staged as
`liboc-engine.so`, next to `liboc-opentui.so`. Verify with
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

### ghost sockets + stale engines
Match native processes by the engine library name (`liboc-engine.so`), never
the bare `opencode`. A dead engine can leave an ownerless LISTEN socket (only
reboot clears). Never `adb reverse` an engine port; forward only. The
supervisor owns the ports (each agent's last-good one, else a free one) and
JS reads an engine's address with `getEngineAuth`. A 401 from an engine's own
port means another engine answers there with another password, so ours never
bound it: the supervisor relaunches on a fresh port. Everything an engine
starts inherits `PHONECANDO_AGENT=<agentId>`, and a start or stop ends every
process of our uid carrying that agent's tag (`/proc/<pid>/environ`), so a
leftover from an earlier app process cannot squat or pile up.

### projects, envs and images
Directory isolation inside one agent = PROJECT (folder + chats). ENV = a fixed
base OS that is never modified (the Default env baked into the APK, an Own env
from a container registry, or Android with no Linux). IMAGE = a VM-like machine
made from an env, with its own HOME (agent config, chats, projects, keys);
reset replaces its system and keeps HOME. One agent per image, each with its
own engine, port, password and bridge token. The TUI takes the project folder
as its trailing argument (v2 has no `--dir`).

## Linux images

### proot runs from the engine's process
proot with its loader unbundled (`PROOT_LOADER` points at
`libproot-loader.so`, never a copy in tmp) and our launcher, invoked by its
own name and through a symlinked shim, all exec from the engine's own
process (`untrusted_app`) on Android 16 with no exec denials
(device-verified on the Moto G96, full debug build, 2026-11-06). The engine
itself stays a bionic binary outside proot; only its shell and commands go
through the shims.

### two spellings of the data dir
Device-verified on the same run: inside the app process `getcwd()` says
`/data/data/<pkg>/…` while Context's
dirs and `run-as` say `/data/user/0/<pkg>/…`; both name one dir. So
`launch.conf` binds `home/` and `tmp/` at their host path under both
spellings and lists both as `same` paths, or a command loses its project
folder (`lre/image` `PathSpellings`, `phonecando-linux`
`DataDirSpellings`). A secondary user (`/data/user/<n>/<pkg>`) or adoptable
storage has only one spelling.

### a CMake executable as `lib*.so`
AGP packages only `lib*.so` names, and it sets
`CMAKE_RUNTIME_OUTPUT_DIRECTORY` to `obj/<abi>` as well, so an `EXECUTABLE`
target whose output name is `libphonecando_launch.so` lands beside the
libraries and ships in `lib/<abi>/`. NDK r27 does not align for 16 KB pages
by itself: link with an explicit `-Wl,-z,max-page-size=16384`.

### a library's `noCompress` doesn't reach the APK
AGP decides asset compression from the APP module's list, so
`phonecando-linux`'s own `noCompress 'xz'` left the Default image deflated
in the APK (`unzip -v` showed `Defl:N`; checked 2026-11-07). The app gets it
from `app/plugins/withStoredAssets.js`; the APK audit fails a deflated
`assets/default-image/rootfs.tar.xz`. After first staging the dev image,
Gradle reported the library's `mergeFullDebugAssets` up to date with an
empty output once; `./gradlew :phonecando-linux:mergeFullDebugAssets
--rerun` fixed it.

### the proot loader has no INTERP
`libproot-loader.so` is a static ELF with no `PT_INTERP`, by design: proot
execs it in each traced process to load the guest program, so it cannot
lean on a dynamic linker itself. An ELF check that expects an INTERP on
every payload file must skip it.

### paths and /proc
Unix socket paths are capped at 108 bytes, so image ids stay short (setup
flags an image whose `home/` or `tmp/` leaves too little room for socket
names). Android's sepolicy hides `/proc/loadavg`, `stat`, `uptime`,
`version` and `vmstat` from apps; each image binds static stand-ins over
them so `top`, `ps`, `free` and `uptime` work.

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
cannot drift. The terminal canvas stays `#0a0a0a`; the opencode web adapter's `themeScript` maps
the palette onto opencode's `--v2-*` vars (see `modules/chat.md`).

## Related

- Module docs: `modules/runner.md`, `modules/terminal.md`,
  `modules/chat.md`
- Linux runtime: `../../docs/overview/architecture.md` → Linux runtime
- Current limits: `../../docs/release/known-limits.md`
