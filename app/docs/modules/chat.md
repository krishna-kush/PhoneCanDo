# Chat (opencode web UI)

The Home/chat tab is the active agent's web UI in a WebView (opencode v2's
today). It is not a native chat implementation: the web UI owns projects and
sessions end to end, and there is no app-side chat or project creation. The
header title is the active agent's name; tapping it opens the agent switcher
(`ui/common/agent-switcher/`), which lists every agent with its engine state
and makes the tapped one active (`src/state/agents.ts`). Creating and
deleting agents lives on the Env tab.

## Pairing and loading

- `ChatWebScreen.tsx` mounts one `AgentWebView.tsx` for the active agent,
  keyed by agent id: a switch mounts a fresh view that pairs with the
  engine where it listens now (an engine can come back on another port)
  and drops the old view's home URL and back stack. opencode names its
  session cookie per port (`opencode_session_<port>`), so engines never
  sign each other's views out. With no agent yet it says so (first launch
  makes one).
- Each mount starts the agent's engine or finds it running
  (`startAgent`: prepare its image, then `ensureEngine`), waits for a fresh
  engine to answer (`waitForEngine`), then asks the agent kind for a
  one-time pairing URL (opencode: `POST /api/pair`, then
  `/auth/connect/{code}`); the cookie authenticates the WebView. A failure
  shows an error with a retry that starts and pairs again.
- While the chat is in front, `useEngineTouch.ts` marks the agent's engine
  used (on showing and every two minutes), so at the running-engine cap it
  is never the one stopped to make room, and takes down the agent's alert or
  return notice (`dismissAgentAlert`; `runner.md` → Notifications).
- The page starts at the web home (projects + sessions), then reopens the
  page the agent was last on: a view remembers its page when it unmounts
  (`lastPage.ts`: path only, in memory, so a cold start opens the home)
  and the next mount replaces the home with it once the home has loaded.
  Project selection persists in the page profile.
- A cover hides the first document load (an unthemed paint) and that
  restore. It never follows `onLoadStart`: react-native-webview fires that
  from `doUpdateVisitedHistory`, so for every history change, in-page ones
  too, while `onLoadEnd` comes only when a document finishes. Going back to
  an in-page entry would leave the cover up.
- The embedded web shell renders its own titlebar; the app hides it in-page
  because `AppHeader` already provides app chrome.

## Chrome and navigation

- Android back and the header back arrow work on every page but the home:
  they walk the web UI history when it has an entry, else load the home.
  Chromium hides history entries the user never touched (the home a
  restore passes through), so a restored page has no entry to go back to.
  At the home, Android back falls through to the app.
- Footer Home (while already on Home) and ⋮ → **opencode home** (the
  kind's label) load the captured web home URL, so a session never strands
  the user.
- The terminal is a separate view of the same agent's engine; use the
  header menu to switch. See `terminal.md`.

## Keyboard

Edge-to-edge (targetSdk 36) means `adjustResize` no longer shrinks the window
for the IME. The chat WebView is wrapped in
`react-native-keyboard-controller`'s `KeyboardAvoidingView`
(`behavior="height"`, `automaticOffset`) so the web composer, model row and
send button stay above Gboard. The terminal keeps its own live-height spacer;
this wrapper is chat-only. Verified with screenshots on the test device.

## Theme

The opencode web adapter's `themeScript` (`src/engine/agents/oc/web.ts`)
maps the app palette onto opencode v2's internal
`--v2-*` CSS variables and writes the `opencode-color-scheme` key. It runs
before content load and again on load/theme changes so scroll and session
state survive a switch. Neither the variables nor the key is a public API:
after an opencode/web-UI bump, re-check
`packages/ui/src/styles/tokens/theme.css`, the semantic mapping and
`oc-theme-preload.js`, then update the mapping. A rename fails silently and
the UI falls back to opencode's palette.

## Related

- `../../src/ui/chat/ChatWebScreen.tsx`, `../../src/ui/chat/AgentWebView.tsx`
- `../../src/ui/chat/webNavigation.ts`, `../../src/ui/chat/useEngineTouch.ts`
- `../../src/ui/chat/useOpenChat.ts` (tells the runner which chat is on
  screen, via the kind's `web.sessionOf`, so the service notification
  leaves it out; see `runner.md` → Notifications)
- `../../src/ui/chat/lastPage.ts` (pure; vectors in
  `../../scripts/vectors/test_chat_pages.js`)
- `../../src/engine/agents/oc/` (opencode REST client, web adapter, TUI recipe)
- `../../src/engine/connection.ts` (engine address and health waits)
- Engines, ports and lifetime: `runner.md`
