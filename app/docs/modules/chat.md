# Chat (Home)

Home is the active agent's own UI, as its kind's manifest says (KindView
`home`): its web UI in a WebView (opencode v2's today), or, for a kind whose
engine is a TUI, that TUI (see TUI home below). It is not a native chat
implementation: the agent's UI owns projects and sessions end to end, and
there is no app-side chat or project creation. Home's header
(`HomeHeader.tsx`) shows the active agent's face (A-01, `ui/common/face/`)
and name; tapping them opens the drawer (see Navigation below), which
lists every agent with its engine state and makes the tapped one active
(`src/state/agents.ts`). Creating and deleting agents starts there too.

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
  because `HomeHeader` already provides app chrome.

## Chrome and navigation

- Android Back on Home walks the web UI history when it has an entry, else
  loads the home. Chromium hides history entries the user never touched
  (the home a restore passes through), so a restored page has no entry to
  go back to. At the home, Back falls through and the app goes.
- ⋮ → **opencode home** (the kind's label) loads the captured web home URL,
  so a session never strands the user.
- The terminal is a separate view of the same agent's engine; use the
  header menu to switch. See `terminal.md`.

## Navigation: pages over Home, the drawer, Back

- No tabs and no on-screen back arrows. Home stays mounted at the bottom;
  every other place is a page on a stack over it (`src/state/app/`).
  Layers under the top stay mounted and laid out, only invisible, so a web
  UI or a terminal under a page keeps its state and its size.
- Motion (`ui/nav/motion.ts`) follows Android 14+: a page slides in from a
  quarter of the width while it fades in; Back shrinks it to 90%, then it
  slides off to the right. Transform and opacity only: Reanimated's
  `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` (app/package.json, a native build
  flag) applies them without a layout commit; without it every frame
  re-lays out the whole app.
- The motion follows the stack by a store subscription
  (`ui/nav/transitionStore.ts`), not a React effect, so Back starts its
  slide on the UI thread before any render. A new page slides two frames
  after it commits, so its first draw does not eat the slide's start.
- A page draws its first screen on the tap and the rest once its slide is
  over (`ui/nav/slidIn.ts`): `AfterSlide` holds a part below the fold and
  `useSlidInList` a list's rows past it, until the stack first rests with
  the page drawn. That flip is a React transition, so a tap right after
  the slide is not held up by the rest of the page.
  Nothing above the stack re-renders for a transition: App does not
  subscribe to the stack, and Home reads whether it is in front from
  `ui/nav/homeInFront.ts`.
- Under that flag an animated view's React props keep its mount-time
  values; Reanimated 4.5 let a React commit show them for a frame (4.7.1
  writes the newest again after each mount). So which layer plays which part is UI-thread state (`progress.ts`,
  `motion.ts` `roleOf`), `PageLayer` renders once, and only `LayerBody`
  re-renders with a part change; it is never flattened, so a part change
  never moves a page or Home's web view to a new native parent.
- The drawer (`ui/drawer/`) opens from the header's agent chip, never from
  the screen's left edge (on gesture navigation that edge is Back). Its
  content mounts on the first open and stays; its faces hold still while
  it is shut.
- Back is one chain (`ui/nav/useBackChain.ts`): a step inside a page
  (`interceptors.ts`), the drawer, the top page, then the web UI's history.
  While a page or the drawer is open, `phonecando-back-gesture` runs
  `ui/nav/backWorklet.ts` on the UI thread for each step of the gesture, so
  the page or the drawer follows the thumb while JS is busy; JS hears only
  the commit. Without it (Home, a back key, older Android) Back arrives
  through React Native's BackHandler and runs the same chain.
- When New agent's run ends, the agent's page takes the place of its
  steps, so Back returns to where the run began. A deleted agent's pages
  close. A notification tap brings its place to the front, but an open
  terminal stays on top.
- Settings (`ui/settings/SettingsScreen.tsx`) shows Phone control on
  itself, at the top; under it a short hub of one row per page (Look &
  feel, Agents & models, Privacy, Updates, About), each saying what is
  inside and how it is set now; a row opens its page (the
  `settings-page` route).

## The RAM warning

The runner's memory guard (`engine/memory.ts`, contract
`NativeMemoryStatus`) feeds `state/memory.ts`, and
`state/logic/memoryEpisode.ts` decides when the warning opens by itself:
once when memory runs short and once more if it turns critical, not again
until the level has stayed ok for three minutes. The warning (`ui/memory/`,
mounted once over everything by `MemoryGuard`) is a sheet from the bottom:
A-01 sweating, the phone's RAM, the countdown to the runner stopping one
agent itself, the running agents (each with Stop) and the loaded local
models (Stop asks in place: the agents on it stop first). Closed with
"I'll handle it", a chip in Home's or a terminal's bar, or a pill at the
foot of any other page, keeps the countdown in sight and opens it again.
After an automatic stop a line drops in at the top saying who was stopped.
Settings → Agents & models sets the caps (`engine/runLimits.ts`, none by
default) and opens the warning at any level.

## Agent messages

Agents message each other through the runner's bridge tools (`agents_send`
and friends; the runner keeps the log, see `runner.md`). The app only
reads it (`engine/messages/`: `native.ts` the calls, `parse.ts` the
checked shapes) into `state/messages.ts`: each agent's unread count from
the drawer's first mount, and the log and the screen queue while a
Messages page is open; the runner's `phonecandoMessages` event and a
return to the foreground re-read them. The Messages page (`ui/messages/`,
route `messages`, optional `agentId`) lists them newest first: who to
whom and when, the text (selectable), the message a reply answers (a tap
goes to it), each recipient's status (waiting, delivered, read, refused
with the reason) and whom it woke; runner notices in the secondary ink;
the screen queue in one line at the top. The drawer marks each agent's
unread count and, once there are two agents, has a Messages row; an
agent's Settings block has Messages (filtered to it) and "Other agents
can wake it" (`wakeable`, on by default) for a kind that can be woken
(KindView `canWake`), else a line saying it reads them at its next turn.
Pure parts in `ui/messages/logic/`, checked by
`scripts/vectors/test_messages.js`.

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
(`behavior="padding"`, `automaticOffset`) so the web composer, model row and
send button stay above Gboard. Not `"height"`: it pins a height while the
keyboard is up, the height stays on the view after it closes (Reanimated
keeps a dropped prop's last value), and a card shown later at Home's foot
(First shift, Having fun?) was pushed off screen. A TUI home uses the terminal's own spacer
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
  screen, via the web adapter's `sessionOf`, so a run that ends there is
  seen; see `runner.md` → Notifications)
- `../../src/ui/chat/lastPage.ts` (pure; vectors in
  `../../scripts/vectors/test_chat_pages.js`)
- `../../src/engine/agents/webAdapter.ts` (pure; vectors in
  `../../scripts/vectors/test_web_adapter.js`, byte-equal to the scripts
  opencode had before its adapter became data)
- `../../../agents/native/opencode/agent.json` (opencode's pairing, web
  adapter and TUI recipe)
- `../../src/engine/connection.ts` (health waits)
- Engines, ports and lifetime: `runner.md`
