# phonecando-terminal (PTY + xterm)

`phonecando-terminal` (`com.phonecando.terminal`) is the Expo module that
provides the JNI PTY, the hosted PTYs of TUI engines and the terminal's one
native view. It is our own clean-room code; no Termux GPL code.

## Native API

- `android/src/main/cpp/pty/`: our own PTY core in plain POSIX (not Termux,
  no JNI). The parent builds argv, envp and cwd before `fork` (a bare
  `argv[0]` is looked up in the new env's absolute PATH entries); the child
  makes only async-signal-safe calls: default dispositions, empty signal
  mask, new session with the slave as its controlling tty (none when the
  open asks `handOver: true`, for our Linux launcher, which hands the
  terminal to the guest shell), every fd from 4 up
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
- `view/DirectionLockView.kt`: the one native view (see Input and sizing).

## PtyHost (hosted PTYs)

`com.phonecando.terminal.host` lets other native code run a program on a
PTY whose lifetime it owns: the runner's TUI engines, which keep running
when you leave the tab or the app. `PtyHost` is a process-wide object, not
part of the Expo module, so a JS reload (which hangs up the module's own
sessions) leaves its PTYs running. JS never sees their fds.

- `PtyHost.spawn(PtySpawnSpec, PtySink): HostedPty` starts the program
  through the same path as the module's sessions (`PtySpawn.kt`, then
  `PtyChild` reaps exactly its pid). The spec's env is the program's whole
  environment as `KEY=VALUE` entries; nothing of ours is merged in. A
  failed spawn throws `IOException` naming the step.
- One reader thread per PTY waits in `pty_wait_readable` (`poll(2)`,
  `pty_io.c`) for at most 200 ms, reads up to 16 KiB and hands it to
  `PtySink.onOutput` (the array is reused). It stops on EIO (the child side
  is gone), on `close()`, or once the program has been reaped and a wait
  passes with nothing more to read.
- That thread alone closes the master, so a recycled fd number is never
  touched; `write` and `resize` check it under a lock and do nothing after
  the hang-up. `write` gives up after ~1 s without progress, and a
  same-size `resize` still sends SIGWINCH, as for the module's sessions.
- After the loop: the master is closed (the kernel hangs up the session).
  The program gets 3 s to exit by itself, unless `close()` asked for the
  hang-up. Then SIGHUP goes to its group, and SIGKILL 3 s later (the
  runner's `ProcessReaper` grace). `onExit` comes once, after the last
  output: the exit code, 128 + the signal, or -1 when the status was not
  ours to read.

## Renderer

Rendering is **not** native: xterm.js 6 in a WebView (`assets/xterm/`),
render-only (`disableStdin`). The page never owns the IME. A swipe goes
where a desktop terminal sends a wheel, chosen from the modes the program
set (`term.modes`), never from the agent kind:

- mouse reports on (opencode's alt-screen TUI, which keeps no xterm
  scrollback): `scroll` step bursts that RN turns into SGR wheel events
  (`keys.ts` `wheelSeq`);
- an alternate screen without mouse reports (less, man): arrow keys
  (`arrowSeq`);
- anything else (a shell, an inline TUI such as Gemini CLI or Claude Code):
  the page's own scrollback, 1:1 with the finger plus a fling; typing
  brings it back to the bottom (`scrolled`, `__toBottom`).

Only true taps post `tap`. The page also posts the title a program sets
(`{type:'title'}`, OSC 0/2): an agent TUI names its chat there, and
`useOpenTuiChat.ts` reports that chat as open so a run that ends there is
seen (`runner.md` → Notifications).

`app/scripts/inline-xterm.js` bundles `xterm.js` (base64) + `xterm.css` +
`terminal.js` into `terminal.bundle.html`. Re-run after page changes.

## Input and sizing

The IME contract is load-bearing:

- A hidden RN `TextInput` owns the keyboard and holds a mirror of the TUI's
  current line as a real document. Every change is reconciled to DELs +
  inserts (`src/ui/terminal/reconcile.ts`). PTY bytes are irreversible, hence
  the shadow, hence never WebView stdin.
- The xterm page measures its own pixels (`ResizeObserver`, the true cell
  from `_renderService.dimensions`, as addon-fit does; no per-device
  numbers). The grid follows the box every frame (`fitLocal`), so it never
  sits in a box of another size, but the page posts `{ready,termsize}` only
  once the layout has been still for 120 ms, so an inline TUI never draws
  itself for a passing size. RN applies that size to the PTY (`TIOCSWINSZ`,
  which signals SIGWINCH).
- Every resize after the first goes through `resizeKeeping`, one at a
  time (a burst collapses to the latest size). xterm sizes the screen
  around the cursor: shrinking drops every row below it, growing pulls
  scrollback back only when nothing is below it. An inline TUI keeps its
  cursor on its input line above its footer and redraws nothing on a
  height-only change, so it would lose its footer. So on the normal screen
  a height-only resize parks the cursor (xterm's buffer row, set directly)
  on the last row with text, or on the last row when text ends within two
  rows of it (Gemini CLI leaves a blank line under its frame), then puts
  it back: the content stays anchored at the bottom. Text that ends higher
  up (a prompt with blank rows below) stays where it is. Blanks use the TUI
  bg (the theme's `termBg`: `#0a0a0a` dark, white light), never `#000`.
- The keyboard: one tracker (`src/ui/common/keyboard/KeyboardTracker.tsx`,
  inside the KeyboardProvider and SafeAreaProvider) reads
  `react-native-keyboard-controller`'s live `e.height` every frame
  (`keyboardDidShow` understates a settled Gboard) and turns it into the
  room the keyboard takes (`sizing.ts` `spacerPad`: above the bottom
  inset, plus air), a Reanimated value on the UI thread
  (`keyboard/room.ts`; React state would lag it by frames). JS only hears
  open/closed (`src/state/keyboard.ts`). A terminal's spacer is an
  `Animated.View` that follows the room every frame. Nothing sits below a
  terminal, so the spacer is the whole room.
  Vectors: `scripts/vectors/test_keyboard_room.js`.
- The invisible input is an absolute 1x1 overlay: Android enforces a
  min-height on multiline fields, so an in-flow field eats a layout row.
- Fold every text-inserting path (extra keys such as `|` and `~`, a
  suggested command) into the shadow, or Gboard's backspace diffs from a
  wrong base. Never use `visible-password` (it kills mic/glide/predictions).

Pure logic stays pure: `keys.ts`, `reconcile.ts`, `sizing.ts`,
`theme/replies.ts`; hooks are
`usePtySession.ts`, `useMirrorInput.ts`, `useInitialInput.ts` and
`useViewFocus.ts`; `sessionRecipe.ts` builds what runs; the row is
`ExtraKeysBar.tsx`.
`TerminalView.tsx` holds all of it (page, hidden input, spacer, row) for
every terminal, over a transport (`transport/`): `local.ts`, a PTY of its
own, or `engine.ts`, a TUI engine's hosted PTY (see Engine terminal). Its
`active` prop gates autofocus, tap-to-focus and the output pump, because
the page stack keeps every page mounted under the top one: a terminal page
is active only while it is the page in front (`ui/nav/pageActive.ts`), a
TUI home only while no page is over Home. A terminal opens as a page
(`TerminalPage.tsx`: what it is attached to, a ⋮ menu; Back closes it),
one at a time.
- The WebView sits in `DirectionLockView` (`TerminalGestureHost` from
  `src/engine/terminal.ts`): on touch-down it asks every parent not to
  intercept; past the touch slop it keeps that for a mostly vertical move
  and gives it back for a sideways one. So a vertical swipe scrolls the
  terminal all the way, and a sideways one goes to the parent (the page
  reads the takeover as `touchcancel`).

## Theme

The terminal follows the app's scheme (`src/ui/terminal/theme/`). Its
colours are the `term*` roles of `theme/tokens.json` (`palette.ts`): dark
is the look it always had (`#0a0a0a`, opencode's dark background), light
is the app's own light surfaces (`bg`, with its `fg`, `panel` and `line`)
with an ANSI set that reads on them (4.5:1 normal, 3:1 bright). A
program that paints its own background (a named light theme) keeps it. The page
starts in the scheme (the theme rides on its URL, and its head paints the
background first) and follows a change at once (`__setTheme`); the
WebView, its box, the views around it and the extra-keys row and its keys
(`termKey`, `termKeyPress`) take the same scheme (`termLook`).

Programs hear the scheme the standard ways; whether they use it is theirs:

- `COLORFGBG` at start: `15;0` dark, `0;15` light (vim, termenv, Claude
  Code). A session adds it to its recipe (`sessionRecipe.ts`), a TUI engine
  gets it from the runner. A program keeps the value it started with (an
  engine until it restarts); the queries below follow a change.
- Queries: `?` in OSC 10 / 11 / 12 (foreground, background, cursor) or
  OSC 4 (palette) gets `rgb:rrrr/gggg/bbbb` (Gemini CLI, Claude Code's
  auto theme, opencode's TUI, neovim); `CSI ? 996 n` gets `CSI ? 997 ; 1 n`
  dark or `; 2 n` light. Device attributes (`CSI c`, as xterm.js answers)
  and the status (`CSI 5 n`) are answered too: programs send one after a
  colour query to learn no more answers are coming (Claude Code and Gemini
  CLI DA1, neovim DSR 5).
- DEC mode 2031 (contour's colour palette update notifications): while a
  program has it on (until it resets it or the terminal), a change of
  scheme sends it the `997` report. Claude Code and opencode's TUI turn it
  on and ask for the colours again.

xterm.js drops its own answers under `disableStdin`, so the page reports
each query it parses (`{type:'query'}`, `{type:'themeReports'}`) and RN
answers through the PTY (`replies.ts`; vectors
`scripts/vectors/test_term_replies.js`). An engine's PTY is answered by the
runner from the first byte (`runner.md` → TUI engines → Answers, from the
theme `useEngineTerminalTheme` gives it at the root); its transport says
`hostAnswers` and RN writes nothing, the replay's old queries included.
Not answered: the cursor position (`CSI 6 n`), DA2, DECRQM.

## Sessions

A terminal session (`TerminalSession` in `src/state/app/routes.ts`) is
one of two kinds. Only the recipe differs: `TerminalScreen.tsx` hands it to
a `TerminalView` on the local transport, through the same generic PTY seam
(`src/engine/terminal.ts`), and the PTY closes with the screen. Every open is
a new page, so it mounts afresh; closing returns to the page underneath.

- `tui`: the agent kind's terminal UI attached to that agent's engine, in a
  folder of the agent's HOME (its image's `home/`). The header ⋮ menu opens
  it through `FolderPicker.tsx` (listed through `src/engine/files.ts`),
  rooted at the active agent's HOME and opened in its work folder
  `~/projects` (the agent's `projectDir`; HOME until an engine start has
  made it, `runner.md` → Agent images). The engine is started first
  (`startAgent`) and a fresh one waited for, so the first open attaches.
  The runner renders the recipe from the kind's manifest
  (`surfaces.terminal.client`, `clientRecipe`); opencode's is
  `liboc-engine.so --server <url> [--session <id>] <dir>` with the agent's
  password, so the terminal and the web UI stay on one live engine. The
  recipe goes straight to the PTY; JS keeps no copy. The chat the TUI shows
  comes from its terminal title through the kind's `chatTitle` regex
  (`src/engine/agents/chatTitle.ts`).
- `linux`: a login shell in the agent's image (`phonecando-linux`
  `terminalRecipe`, which makes the work folder first): `shims/sh -c 'cd
  /root/projects; exec "$SHELL" -l'`, which our launcher runs in the guest
  through proot, with `HOME=/root` and `TMPDIR=/tmp` (where `home/` and
  `tmp/` are bound). The guest sh enters the folder, so the prompt shows
  `~/projects`, not the host's spelling of `home/projects`. The PTY opens
  as no session's terminal (the recipe's `handOver`) and the guest shell
  takes it (`lre/docs/modules/launcher.md`): job control, Ctrl-C and
  resize work as on a PC, and closing the tab hangs up the shell's jobs,
  except `nohup`'d and `disown`ed ones. A job Ctrl-Z stops keeps running
  under proot (`lre/docs/release/known-limits.md`). An Android image gets
  `/system/bin/sh -l` in its `home/projects/`. Both open on a cooked tty
  (`raw: false` in `sessionRecipe.ts`). The image gets its per-start
  preparation first (`prepareAgentImage`, as for its engine, so the
  image's `launch.conf` never changes between the two). The agent's page
  and its Machine page open it, optionally with a suggested command
  (`initialInput`: the line that installs missing tools, or the packages
  to reinstall after a reset).

`sessionRecipe.ts` builds the recipe when the session opens and always drops
`PHONECANDO_AGENT` from its env: an engine start ends every process carrying
that agent's tag, and a terminal is not an engine. `useInitialInput.ts` types
a suggested command once the program first waits for input (`outputSettled`
from `usePtySession.ts`), without Enter: it goes through the mirror's own
change path, so the shadow holds it and backspace, glide and the mic edit it
like typed text. It is skipped once the user has typed.

## Engine terminal (TUI home)

A kind with `engine.style: "tui"` runs its program in a PTY the runner's
foreground service owns (`runner.md`), and Home shows it
(`../../src/ui/chat/tui/AgentTuiHome.tsx`, a `TerminalView` on the engine
transport). The program keeps running when a page over Home, a terminal or
the app goes away.

- The view attaches as the PTY's one viewer
  (`src/engine/engineTerminal.ts`: `engineTerminalAttach`, `…Read`,
  `…Write`, `…Resize`, `…Detach`); a new attach detaches the old one.
  Unmounting only detaches.
- Attach reports the PTY's size. Once the page has measured itself, xterm
  takes that size, the replay (the terminal modes and the screen so far) is
  drained in big reads, and the measured size follows through the page's
  `__resizeAfterWrites` (xterm parses writes later, while `resize` applies at
  once) and to the PTY. That resize signals even at the same size, so the
  program repaints at the result.
- A read that says `ended` (the program stopped or died) shows "top
  stopped" (the kind's label) with Restart, which starts the engine again
  and attaches a fresh view; a new start from elsewhere (the app's
  foreground start, the agent page's Start) does the same by itself.
  `detached` (another viewer took over) only stops the pump.
- The title the program sets reaches `useOpenTuiChat.ts` as for a TUI
  client, through the kind's `chatTitle`.
- The view tells the runner whether it shows the program
  (`useViewFocus.ts`: `active` and the app in front; after the replay and
  on every change), which the runner passes on as focus reports when the
  program asked for them (`runner.md` → TUI engines → Answers). The page
  never reports focus itself (xterm.js drops its replies under
  `disableStdin`, and RN ignores the page's `input`), so the hidden input
  taking focus from xterm's textarea never tells the program it lost focus.
- Nothing else opens this PTY: for a TUI-home kind the header ⋮ menu offers
  the kind's home and a Linux shell in its machine, never its terminal UI.

## Verification

- `pnpm check:vectors` covers `keys.ts`, `reconcile.ts`, scroll keys, the
  keyboard room and the terminal's answers (`theme/replies.ts`); keep
  vectors in sync or delete them.
- `sh app/modules/phonecando-terminal/android/src/test/c/run.sh` runs the PTY
  core on the host (spawn, env, fds, signals, reaping, kill, resize, the
  poll wait), with `close_range` and with the fallback loop; CI runs it in
  `android.yml`.
- logcat tags: `[phonecando-kb]`, `[phonecando-size]`.
- Prove sizing on-device with `adb exec-out screencap`; no sizing claim from
  `tsc` alone.

## Related

- One terminal (page, input, sizing, keys): `../../src/ui/terminal/TerminalView.tsx`
- A session around it: `../../src/ui/terminal/TerminalScreen.tsx`
- What a session runs: `../../src/ui/terminal/sessionRecipe.ts`
- Dev loop and bundle command: `../guides/development.md`
- Home (web UI or TUI home) and the navigation around it: `chat.md`
