# Chat (opencode web UI)

The Home/chat tab is the opencode v2 web UI in a WebView. It is not a
native chat implementation: the web UI owns projects and sessions end to end,
and there is no app-side chat or project creation.

## Pairing and loading

- `ChatWebScreen.tsx` starts the engine through `ensureServeRunning` and
  adopts the service-owned port.
- Each mount requests a fresh pairing code (`POST /api/pair`) and loads
  `/auth/connect/{code}`; the cookie authenticates the WebView. A 401/403
  shows an error with a retry that re-pairs.
- The page starts at the web home (projects + sessions). Project selection
  persists in the page profile.
- The embedded web shell renders its own titlebar; the app hides it in-page
  because `AppHeader` already provides app chrome.

## Chrome and navigation

- Android back walks the web UI history before exiting. The header back arrow
  appears only when the web UI is away from home.
- Footer Home (while already on Home) and ⋮ → **OpenCode home** load the
  captured opencode home URL, so a session never strands the user.
- The terminal is a separate view of the same engine; use the header menu to
  switch. See `terminal.md`.

## Keyboard

Edge-to-edge (targetSdk 36) means `adjustResize` no longer shrinks the window
for the IME. The chat WebView is wrapped in
`react-native-keyboard-controller`'s `KeyboardAvoidingView`
(`behavior="height"`, `automaticOffset`) so the web composer, model row and
send button stay above Gboard. The terminal keeps its own live-height spacer;
this wrapper is chat-only. Verified with screenshots on the test device.

## Theme

`ChatWebScreen.themeScript` maps the app palette onto opencode v2's internal
`--v2-*` CSS variables and writes the `opencode-color-scheme` key. It runs
before content load and again on load/theme changes so scroll and session
state survive a switch. Neither the variables nor the key is a public API:
after an opencode/web-UI bump, re-check
`packages/ui/src/styles/tokens/theme.css`, the semantic mapping and
`oc-theme-preload.js`, then update the mapping. A rename fails silently and
the UI falls back to opencode's palette.

## Related

- `../../src/ui/chat/ChatWebScreen.tsx`
- `../../src/ui/chat/webNavigation.ts`
- `../../src/engine/sessions.ts` (pairing, health waits, session listing)
- Engine and port ownership: `runner.md`
