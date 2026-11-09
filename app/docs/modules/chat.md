# Chat (the Home tab)

The Home/chat tab is the active agent's own UI, as its kind's manifest says
(KindView `home`): its web UI in a WebView (opencode v2's today), or, for a
kind whose engine is a TUI, that TUI (see TUI home below). It is not a
native chat implementation: the agent's UI owns projects and sessions end to
end, and there is no app-side chat or project creation. The header title is
the active agent's name; tapping it opens the agent switcher
(`ui/common/agent-switcher/`), which lists every agent with its engine state
and makes the tapped one active (`src/state/agents.ts`). Creating and
deleting agents lives on the Env tab.

## Pairing and loading

- `HomeScreen.tsx` mounts one `AgentWebView.tsx` for the active agent of a
  web-home kind, keyed by agent id: a switch mounts a fresh view that pairs with the
  engine where it listens now (an engine can come back on another port)
  and drops the old view's home URL and back stack. opencode names its
  session cookie per port (`opencode_session_<port>`), so engines never
  sign each other's views out. With no agent yet it says so (first launch
  makes one).
- Each mount starts the agent's engine or finds it running
  (`startAgent`: prepare its image, then `ensureEngine`), waits for a fresh
  engine to answer (`waitForEngine`), then asks the runner for a one-time
  pairing URL (`pairWebUi`, as the kind's manifest says: opencode
  `POST /api/pair`, then `/auth/connect/{code}`); the cookie authenticates
  the WebView. The engine password never reaches JS. A failure shows an
  error with a retry that starts and pairs again.
- While the chat is in front (either home), `useEngineTouch.ts` marks the
  agent's engine used (on showing and every two minutes), so at the
  running-engine cap it is never the one stopped to make room, and takes
  down the agent's alert or return notice (`dismissAgentAlert`; `runner.md`
  → Notifications).
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

## TUI home

For a kind whose `home` is `tui` (its engine runs a program in a PTY the
runner's service owns), `HomeScreen.tsx` mounts `tui/AgentTuiHome.tsx`
instead, keyed by agent id. It starts the engine or finds it running
(`startAgent`), waits for the `ready` state the runner's events report, then
shows a `TerminalView` on the engine transport: the replay restores the
screen, and leaving only detaches, so the program keeps running
(`terminal.md` → Engine terminal). `tui/tuiPhase.ts` (pure) decides between
starting, attached, stopped (Restart) and failed (Retry). A program that ends
while shown keeps its last screen on view, read-only (it often says why it
stopped), with the stopped notice as a bar over the extra keys. The header ⋮ menu
offers the kind's home and "Open Linux shell" (a `linux` terminal session),
never a second view of the engine's PTY.

## Install home

An agent of a kind with an install (`hasInstall`) is installed inside its
machine before its engine may start (`needsInstall` on its record; the
runner refuses with `agent_not_installed`). Until then `HomeScreen.tsx`
mounts `InstallHome.tsx` instead of either home: the run that started when
the agent was made (`state/flows/installAgent.ts`), with its phase, bar and
last log lines, or where it stopped with Retry, or Install
(`ui/env/parts/InstallStatus.tsx`, shared with the agent page). Once the run
records a version the record changes and the agent's own home mounts.

## Open a link

`ui/common/OpenUrlDialog.tsx` shows an agent's `open_url` prompt (its
program called `phonecando-open`, e.g. for a sign-in; `runner.md` →
Notifications) in the same queue as the other bridge prompts
(`useBridgePrompts.ts`): "<agent> wants to open <host>", the full link, and
Open (`Linking.openURL`, only http and https), Copy (native copies it) or
Not now, each answered with `resolveOpenUrl`. The host drops any user info
before an `@` (`promptQueue.ts`), so the heading names where the link goes.

## Keyboard

Edge-to-edge (targetSdk 36) means `adjustResize` no longer shrinks the window
for the IME. The chat WebView is wrapped in
`react-native-keyboard-controller`'s `KeyboardAvoidingView`
(`behavior="height"`, `automaticOffset`) so the web composer, model row and
send button stay above Gboard. A TUI home uses the terminal's own spacer
instead (`terminal.md` → Input and sizing).

## Theme

The kind's web adapter (`surfaces.web.adapter` in its `agent.json`, passed
on in the KindView) is data; `src/engine/agents/webAdapter.ts` builds the
scripts from it. opencode's maps the app palette onto opencode v2's internal
`--v2-*` CSS variables and writes the `opencode-color-scheme` key. The theme
script runs before content load and again on load/theme changes so scroll
and session state survive a switch. Neither the variables nor the key is a
public API: after an opencode/web-UI bump, re-check
`packages/ui/src/styles/tokens/theme.css`, the semantic mapping and
`oc-theme-preload.js`, then update the adapter. A rename fails silently and
the UI falls back to opencode's palette.

## Related

- `../../src/ui/chat/HomeScreen.tsx`, `../../src/ui/chat/AgentWebView.tsx`,
  `../../src/ui/chat/tui/AgentTuiHome.tsx`, `../../src/ui/chat/InstallHome.tsx`
- `../../src/ui/chat/webNavigation.ts`, `../../src/ui/chat/useEngineTouch.ts`
- `../../src/ui/chat/useOpenChat.ts` (tells the runner which chat is on
  screen, via the web adapter's `sessionOf`, so the service notification
  leaves it out; see `runner.md` → Notifications)
- `../../src/ui/chat/lastPage.ts` (pure; vectors in
  `../../scripts/vectors/test_chat_pages.js`)
- `../../src/engine/agents/webAdapter.ts` (pure; vectors in
  `../../scripts/vectors/test_web_adapter.js`, byte-equal to the scripts
  opencode had before its adapter became data)
- `../../../agents/native/opencode/agent.json` (opencode's pairing, web
  adapter and TUI recipe)
- `../../src/engine/connection.ts` (health waits)
- Engines, ports and lifetime: `runner.md`
