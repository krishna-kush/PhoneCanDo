# phonecando-terminal (PTY + xterm)

`phonecando-terminal` (`com.phonecando.terminal`) is the Expo module that
provides the JNI PTY and the WebView bridge for the terminal tab. It is own
code, clean-room; no Termux GPL code.

All native code lives in Expo modules under `app/modules/` (autolinked).
Nothing is hand-edited in `app/android/` (CNG-generated, gitignored).

## Native API

- `android/src/main/cpp/pty/`: our own PTY core in plain POSIX (not Termux,
  no JNI). The parent builds argv, envp and cwd before `fork` (a bare
  `argv[0]` is looked up in the new env's absolute PATH entries); the child
  makes only async-signal-safe calls: default dispositions, empty signal
  mask, new session with the slave as its controlling tty, every fd from 4 up
  closed (`close_range` from API 34, else a bounded loop), `chdir`, `execve`.
  A failed chdir/exec comes back through a close-on-exec pipe as an error.
  The slave starts raw (a TUI reads every key itself) unless the open asks
  for cooked (`raw: false`, for a shell: readline echoes what you type only
  when the tty it starts on echoes). The master fd is **non-blocking** (the JS thread does sync JSI reads; a
  blocking read would stall typing); writes give up after ~1 s without
  progress. Resize does `TIOCSWINSZ` (the kernel signals the foreground group
  on a change) and sends SIGWINCH itself only for a same-size resize, so the
  TUI repaints after a page reload.
- `android/src/main/cpp/forkpty.c`: the JNI glue over that core.
- `PhoneCanDoPty.kt`, `PtySessions.kt`, `PtyChild.kt`,
  `PhoneCanDoTerminalModule.kt`: fd → child registry (a closed or reused fd
  is never touched), one reaper thread per child that waits for exactly that
  pid (never `waitpid(-1)`: it would steal Java's process exits), kill of the
  child's process group, exit status, and close-all on module destroy. The TS
  shim exposes `getLibDir/open/read/write/resize/kill/exitStatus/close`
  (bytes as base64).
- `CMakeLists.txt` builds `libphonecando_pty.so`, linked for 16 KB pages.
- The page posts the title a program sets (`{type:'title'}`, OSC 0/2);
  an agent TUI names its chat there, and `useOpenTuiChat.ts` reports that
  chat as open so the service notification leaves it out (`runner.md` →
  Notifications).

## Renderer

Rendering is **not** native: xterm.js 6 in a WebView (`assets/xterm/`),
render-only (`disableStdin`). The page never owns the IME. Scroll bridge:
the alt-screen TUI has no xterm scrollback, so page swipes post finger-
following `scroll` step bursts (RN sends SGR wheel events into the TUI's
accelerated wheel path) and only true taps post `tap`. `tui.json` sets
`scroll_speed` 1 + `scroll_acceleration` for 1-line-precise slow swipes.

`app/scripts/inline-xterm.js` bundles `xterm.js` (base64) + `xterm.css` +
`terminal.js` into `terminal.bundle.html`. Re-run after page changes.

## Input and sizing

The IME contract is load-bearing:

- A hidden RN `TextInput` owns the keyboard and holds a mirror of the TUI's
  current line as a real document. Every change is reconciled to DELs +
  inserts (`src/ui/terminal/reconcile.ts`). PTY bytes are irreversible, hence
  the shadow, hence never WebView stdin.
- The xterm page measures its own pixels (`ResizeObserver`, true cell from
  `_renderService.dimensions` — same source as addon-fit, no per-device
  numbers) and posts `{ready,termsize}`. RN applies to xterm **and** PTY
  (`TIOCSWINSZ`, which signals SIGWINCH). Bun re-reads `columns/rows` on
  SIGWINCH.
  Remaining blanks use the TUI bg (`#0a0a0a`), never `#000`.
- The keyboard spacer uses `react-native-keyboard-controller` per-frame
  `e.height` (`src/ui/terminal/sizing.ts`), so the accessory bar rides the
  keyboard on any device/IME. `keyboardDidShow` understates settled Gboard.
- The invisible input is an absolute 1x1 overlay: Android enforces a min-height
  on multiline fields, so an in-flow field eats a layout row. Text-inserting
  extra keys (`|`, `~`) are folded into the shadow so Gboard backspace diffs
  from a true base.
- Fold every text-inserting path into the shadow or backspace breaks. Never use
  `visible-password` (it kills mic/glide/predictions).

The implementation and rejected alternatives are documented above. Pure logic
stays pure:
`keys.ts`, `reconcile.ts`, `sizing.ts`; hooks are `usePtySession.ts`,
`useMirrorInput.ts` and `useInitialInput.ts`; `sessionRecipe.ts` builds what
runs; the row is `ExtraKeysBar.tsx`.

## Sessions

A terminal session (`TerminalSession` in `src/state/app/navigation.ts`) is
one of two kinds. Only the recipe differs: input, sizing and rendering are
the same, through the same generic PTY seam (`src/engine/terminal.ts`). App
keys the screen by session id, so every open remounts it; closing returns to
the tab underneath.

- `tui`: the agent kind's terminal UI attached to that agent's engine, in a
  folder of the agent's HOME (its image's `home/`). The header ⋮ menu opens
  it through `FolderPicker.tsx`, rooted at the active agent's HOME and
  listed through `src/engine/files.ts`. The engine is started first
  (`startAgent`) and a fresh one waited for, so the first open attaches.
  opencode's recipe is `liboc-engine.so --server <url> [--session <id>]
  <dir>` with the agent's password, so the terminal and the web UI stay on
  one live engine.
- `linux`: a login shell in the agent's image (`phonecando-linux`
  `terminalRecipe`): `shims/bash -l`, which our launcher runs in the guest
  through proot, with `HOME=/root` and `TMPDIR=/tmp` (where `home/` and
  `tmp/` are bound) and cwd `run/`, so the launcher starts the shell in
  `/root`. An Android image gets `/system/bin/sh -l` in its `home/`. Both
  open on a cooked tty (`raw: false` in `sessionRecipe.ts`). The
  image gets its per-start preparation first (`prepareImageForStart`). The
  Env tab's agent page opens it, optionally with a suggested command
  (`initialInput`: the line that installs missing tools, or the packages to
  reinstall after a reset).

`sessionRecipe.ts` builds the recipe when the session opens and always drops
`PHONECANDO_AGENT` from its env: an engine start ends every process carrying
that agent's tag, and a terminal is not an engine. `useInitialInput.ts` types
a suggested command once the program first waits for input (`outputSettled`
from `usePtySession.ts`), without Enter: it goes through the mirror's own
change path, so the shadow holds it and backspace, glide and the mic edit it
like typed text. It is skipped once the user has typed.

## Verification

- `pnpm check:vectors` covers `keys.ts` and `reconcile.ts`; keep vectors in
  sync or delete them.
- `sh app/modules/phonecando-terminal/android/src/test/c/run.sh` runs the PTY
  core on the host (spawn, env, fds, signals, reaping, kill, resize), with
  `close_range` and with the fallback loop; CI runs it in `android.yml`.
- logcat tags: `[phonecando-kb]`, `[phonecando-size]`.
- Prove sizing on-device with `adb exec-out screencap`; no sizing claim from
  `tsc` alone.

## Related

- Terminal screen layout: `../../src/ui/terminal/TerminalScreen.tsx`
- What a session runs: `../../src/ui/terminal/sessionRecipe.ts`
- Dev loop and bundle command: `../guides/development.md`
- Chat web UI (the other home view): `chat.md`
