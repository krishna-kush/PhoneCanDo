# phonecando-terminal (PTY + xterm)

`phonecando-terminal` (`com.phonecando.terminal`) is the Expo module that
provides the JNI PTY and the WebView bridge for the terminal tab. It is own
code, clean-room; no Termux GPL code.

All native code lives in Expo modules under `app/modules/` (autolinked).
Nothing is hand-edited in `app/android/` (CNG-generated, gitignored).

## Native API

- `android/src/main/cpp/forkpty.c`: own JNI `forkpty` (not Termux). Master fd
  is **non-blocking** (JS thread does sync JSI reads; a blocking read would
  stall typing), writes retry with `poll(POLLOUT)`, `setWinSize` does
  `TIOCSWINSZ` **plus `kill(child, SIGWINCH)`** so the TUI re-reads its size.
- `PhoneCanDoPty.kt` / `PhoneCanDoTerminalModule.kt`: fd
  open/read/write/resize/close. The TS shim exposes
  `getLibDir/open/read/write/resize/close` (bytes as base64).
- `CMakeLists.txt` builds `libphonecando_pty.so`.

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
  (`TIOCSWINSZ` + `SIGWINCH`). Bun re-reads `columns/rows` on SIGWINCH.
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
`keys.ts`, `reconcile.ts`, `sizing.ts`; hooks are `usePtySession.ts` and
`useMirrorInput.ts`; the row is `ExtraKeysBar.tsx`.

## Verification

- `pnpm check:vectors` covers `keys.ts` and `reconcile.ts`; keep vectors in
  sync or delete them.
- logcat tags: `[phonecando-kb]`, `[phonecando-size]`.
- Prove sizing on-device with `adb exec-out screencap`; no sizing claim from
  `tsc` alone.

## Related

- Terminal screen layout: `../../src/ui/terminal/TerminalScreen.tsx`
- Dev loop and bundle command: `../guides/development.md`
- Chat web UI (the other home view): `chat.md`
