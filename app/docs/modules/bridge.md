# Loopback bridge and phone tools

The host bridge exposes `phone_*` tools to every running agent. It is
loopback-only, runs in the app process beside the engines
(`runner/bridge/`), opens with the first engine and closes with the last.

## Endpoints and envelope

- `BridgeServer.kt` uses NanoHTTPD (MIT) for HTTP framing; no hand-rolled
  parser. It binds `127.0.0.1` only, trying in turn the port it bound last
  (prefs `phonecando_bridge`, so engines that outlived a restart keep their
  URL), `9998`, then any free port the OS assigns (`BridgePorts.kt`).
- One bridge serves every agent. Each engine gets the URL and its own
  agent's token at launch as `PHONECANDO_BRIDGE_URL` +
  `PHONECANDO_BRIDGE_TOKEN` (env only, never a config file). The bearer
  names the calling agent (`CallerAuth.kt`, constant-time compare over every
  agent); a missing or unknown token returns 401. Every authenticated call
  marks that agent's engine used.
- `BridgeRouter.kt` decides the rest, in this order: route lookup (404
  `not_found`), flavor (full-only routes answer 404 in lite/play), the
  phone-control switch (403 `automation_off`), the accessibility service
  (503 `automation_unavailable`), the hands (409 `user_has_controls` or
  `paused_by_user` while you have the phone's controls, full builds only;
  Hands below), the JSON body (400), for `/pce/observe|act|pack` the app
  in front (403 `app_not_allowed` or `app_blocked`, and 409
  `user_deciding` for a tap or pack run on PhoneCanDo's own question;
  full builds only, App access below), the screen lease (409
  `control_busy` or `screen_refused`, full builds only), then the handler.
  A refused request never takes the lease, though it may wait in line
  (Screen lease below). `Routes.kt` lists every route with its guards.
- Endpoints: `ping/battery/notify/share/open/clipboard/app/unlock/accessibility`
  plus the automation `/pce/*` routes, `/app-access` (App access below), the agents' messages
  `/agents/list|send|inbox|wait` (Agent messages below), `/keep` (an
  agent's ask to stay up, below), `/schedule/add|list|cancel` (an agent's
  tasks for itself, Schedules below), `/hands/over|wait`, `/status` and
  `/focus` (the agent's presence, Hands below), and `/mcp`, the
  same tools over MCP (below). Bodies over 256 KB return 413. A body is
  its Content-Length bytes read as UTF-8, whatever the Content-Type says
  (`RequestBody`: NanoHTTPD's own `parseBody` takes a body with no charset
  for US-ASCII and turns each byte of non-ASCII text into U+FFFD).
  `BridgeServer.kt` only frames HTTP; `BridgeEntry.kt` checks the token (before the body is even read),
  then hands `/mcp` to the MCP endpoint and every other path to the router.
- Envelope: `{ok:true,data}` or `{ok:false,code,message}`. Refusals by the
  bridge itself use the HTTP status above; app-level failures (no app to
  share to, a PCE error) return 200 + `ok:false`.
- `open`/`share` start activities, so they work only while the app is
  foreground; clipboard reads report `available:false` to background apps
  (API 29+).
- `/notify` posts the agent's own notification, labelled with its name:
  the agent's title with its name beside the app name, or its name as the
  title when it gave none. It is tagged with the agent, one per agent and
  title (a new status with the same title replaces the last; agents never
  replace each other's), and a tap opens that agent's Home. `posted` is
  false when Android shows no notifications for the app. It is on every
  channel and not gated by the phone-control lock: an agent reaching you is
  not phone control. Instead it has its own limits (`presence/NotifyRules`):
  while PhoneCanDo shows that agent's chat (`AppOnScreen` and the chat Home
  shows, `EngineSupervisor.openAgent`) it posts nothing and answers
  `{posted: false, reason}` (say it in the chat instead); otherwise one a
  minute and five an hour per agent, past which it is 429
  `notify_too_often` with `retryAfterMs`. Only posts count; each post
  alerts.
- `/app` is ungated on purpose: it only brings PhoneCanDo back, on an
  optional `home|env|settings` tab with the calling agent active. In front,
  the switch goes to JS at once (the `phonecandoLaunchTarget` event); behind,
  the launch carries the target, and when the call asks for it (`notify`) a
  tap-to-return notice titled with the agent's name ("Done with the phone.
  Tap to return.") is the way back if Android blocked the start. The notice
  sits in the agent's one slot, shared with its alerts, so each agent has at
  most one. Where any agent notification's tap lands, and the agent alerts
  (finished, failed, waiting for your answer), are in `runner.md` →
  Notifications.

## Prompts

`/unlock`, `/accessibility` (full builds only, ungated) and `/app-access`
(full builds only, gated; App access below) ask the user something for one
request and block until the answer, so the agent carries on in the same
turn (`PromptRoutes.kt`, `AppAccessRoutes.kt`, `PromptFlows.kt`). Each
request registers its own prompt (`PromptRegistry.kt`: request id, kind
`unlock|accessibility|app`, agent id and name, reason; an `app` prompt
adds `package` and `label`) and waits on it alone, so a second agent's request never
ends the first one's wait. The app shows the prompts one at a time with the
asking agent's name (`ui/common/promptQueue.ts`, `useBridgePrompts.ts`),
learns of new ones from the `phonecandoBridgePrompt` event and reads
`pendingPrompts` on mount and resume, so a prompt made while the UI was
closed still shows. In front, Home comes forward under the dialog and the
active agent stays. Backgrounded, the bridge also tries to bring the app
forward and posts the prompt's own notification, titled with the asking
agent's name and taken down when the prompt ends; both open that agent's
Home. When the bridge stops, every waiting prompt ends as a refusal.

- `/unlock` shows the biometric/PIN modal over the chat and waits up to
  `waitMs` (default 45 s, 5–90 s). The modal is the only place the gate
  flips; the agent never sees a credential. The gate is one switch for the
  phone, so once any unlock succeeds every waiting unlock request returns
  `unlocked`. Response: `{requested, unlocked, notified}`.
- `/accessibility` shows the in-chat dialog
  (`ui/accessibility/AccessibilityDialog.tsx`; with the restricted-settings
  guide, `RESTRICTED_FLOW` in `guide.ts`, it walks Android's "Restricted
  setting" message, App info → Allow restricted settings and the switch; see
  `runner.md`). The bridge then waits up to `waitMs` (default 240 s,
  30–280 s, under five minutes where HTTP clients give up) for
  `PceAuto.service` to connect, so the agent carries on by itself once the
  switch is on; once it connects, every waiting request returns `enabled`.
  Opening a step's screen keeps the wait going; "Not now" ends that
  request's wait at once (`cancelled:true`). The response is `{opened,
  enabled, cancelled, notified, restricted}`; `restricted` is `sideload`
  when the user went through the guide, else the native guess
  (`RestrictedSettings.state`). The user must flip the system toggle; the
  agent cannot. On `enabled:false` the agent tells the user to follow the
  steps in the app and checks `/ping` (`pce`; `ui` is a compatibility alias)
  when they say done. `/ping` reports the flavor, lock, and PCE state.

## App access

Full builds only (`runner/appaccess/`). Once phone control is unlocked, an
agent still needs the user's yes for each app it reaches: one list for
every agent. PhoneCanDo itself and the default home screen are never asked
about (`PhoneApps`); everything else is, Android's Settings and System UI
included. The verdict (`AppAccessRules`, pure): no package passes (the
result check below covers it), then exempt, a No (blocked, even under Allow
all), Allow all, Always, the agent's own Just now, else ask.

- Gate: `BridgeRouter` checks `AutomationHost.frontPackage()` (the active
  window's package, else the last activity the service saw) for
  `/pce/observe|act|pack` after the lock, service and hands checks and
  before the lease. A launch (`/pce/act` with a `launch` action) is judged
  by the app it opens instead (`AppTargets`), so "open WhatsApp" asked
  from PhoneCanDo's chat asks then, not at the first look inside; `/open`
  by the app Android would hand its link to (`PhoneApps.linkHandler`), or
  not at all when Android can't say (its chooser, or an app hidden from
  us), when the first look inside asks. Ask: 403 `app_not_allowed` ("PhoneCanDo asks the user
  before agents use <label>. Call phone_ask_app with package "<pkg>" …",
  the package named in the message because the tools show the model only
  code and message). Blocked: 403 `app_blocked` (don't use it; hand the
  phone over if the task needs it). Both bodies add `package` and `label`
  (the app's name, else its package). After `/pce/observe` or `/pce/pack`
  returns, the result's top-level `package` is checked the same way and a
  result for an app agents may not use is dropped for the refusal (a tap
  moved the screen into it).
- With no front package (no active window and no activity seen yet) the
  gate passes: observe and pack are caught by the result check, and an act
  carries its snapshot id, so the PCE's stale check refuses one whose
  screen changed.
- The agent watching you drive (a WATCH hand-over) is checked too: its
  observe of an app nobody answered for is refused like any other, and it
  may ask about that app while you drive.
- `/app-access` (`phone_ask_app`, gated, not a screen route): body
  `{package, waitMs?}` (default 120 s, 30–240 s; 400 for a package that is
  not an Android package name). Already allowed: `{asked:false,
  allowed:true}`; blocked: `{asked:false, allowed:false, blocked:true}`.
  Otherwise it opens an `app` prompt and waits until it is answered, the
  verdict stops being ask (another agent's question about that app was
  answered) or the wait runs out: `{asked:true, allowed, answer:
  "always"|"once"|"no"|null, notified, blocked?}`. The question waits its
  turn in the screen line and stops the agent's time while it is up, as
  the unlock dialog does (Screen lease below): a yes starts its time over,
  a no or no answer passes the screen on.
- Answers (the app's `resolveAppAccess`, applied then recorded under the
  prompt's lock, `BridgePrompts.resolveApp`): Always is saved for every
  agent and needs the user's biometric or PIN (`KeystoreAppAccessStore`
  signs it with a per-app Android Keystore key that signs only within 15 s
  of it, as the lock does; taking an app off deletes its key); Just now is
  that agent's alone, in memory, until it hands the phone back (a 200
  `/app`), its engine stops (`agentGone`) or the bridge stops; No blocks
  the app for every agent, kept in plain prefs (a forged one only blocks
  more). Settings → Phone control has the list (`appAccessList`,
  `setAppAccess`), each app's icon (`appIcon`, async: `AppIcons` draws its
  launcher icon once into `cacheDir/app-icons/` as a PNG, again after the
  app updates, and returns its `file://` URI) and Allow all
  (`setAllowAllApps`: on needs the biometric, off needs nothing). Allow all's signed record covers the No list ("allowAll
  v1" and the sorted packages), so it reads on only while that list is the
  one it signed; a No taken off behind our back turns it off and everything
  asks. While it is on, a new No always holds and signs Allow all again, or
  turns it off when there was no biometric just now; lifting a No
  (`setAppAccess` "none", or "always" on a blocked app) re-signs it in the
  same biometric window and is refused (false, nothing changed) without one.
- PhoneCanDo's own questions: PhoneCanDo is exempt, so while an `app` or
  `unlock` prompt or an agent's ACP permission question waits, a
  `/pce/act` or `/pce/pack` with PhoneCanDo in front is 409
  `user_deciding` (`OwnQuestions`): only the user answers. Observing stays
  allowed.

## Screen lease

Several agents can run at once, but one drives the screen at a time
(`ScreenLease.kt`, full builds only). The PCE keeps one current snapshot per
phone, so another agent's observe would invalidate the first one's snapshot
ids, and a long act holds the PCE lane. The first agent to call a screen
route (`/pce/observe`, `/pce/act`, `/pce/pack`, `/open`, `/share`, `/app`,
`/hands/over`) holds the screen until it has been idle for 30 s, counted from the end of
its last screen request; its own requests always pass, so observe then act
cannot be split by another agent. `/ping`, `/battery`, `/notify`,
`/clipboard`, `/pce/describe`, `/hands/wait`, `/status`, `/focus` and the
prompts are not screen routes. Lite
and play have no driver, so they take no lease.

The others wait in line, first come first served. A screen request from
another agent joins the line once and gets 409 `control_busy` with
`holder`, `retryAfterMs` and its `place` (1-based): "`<holder>` holds the
screen; you are #`<place>` in line; we'll message you when it is yours". The
holder hears of each new waiter once (`ScreenNotices.waiting`). When the
holder's lease ends (it calls `/app`, `phone_return`, done with the phone;
its run ends, `runEnded`; it has been idle 30 s while someone waits; its
engine stops, `forget`, or its agent is deleted), the screen is reserved
for the first in line for 30 s and that agent is told it is theirs
(`ScreenNotices.yours`, which may wake it): only its claim takes the
screen, and if it does not come the next in line gets the reservation. A
run has ended when its engine's event stream gives a verdict, a stop or a
deleted session and the agent has no chat left working or waiting for your
answer (`EngineStreams`, `ChatBoard.busy`), so a subagent's verdict or a
second chat's end does not count; a screen request still running keeps the
screen until it ends, and the agent's own place in line or reservation
stays. So holding the screen means a run is driving it, which is what an
agent's question reads to bring PhoneCanDo forward (`runner.md` →
Notifications). An idle holder nobody waits for keeps the screen until
someone claims it or its run ends. `ScreenTicker` moves the line on every
second, so a waiter hears even when no agent calls. A reservation is not
use: `Bridge.screenInUse()` still means a screen request runs or ended
under 30 s ago. The messages side sends the notices as runner notices and
reads the line for `agents_list` and the app (`ScreenLease.line()`).

A place in line is never the screen nor an unlock: only an unlocked agent
gets a ticket, and a locked agent first in line still gets 403
`automation_off`. While another agent has the screen, a locked agent's
screen request and its `/unlock` join the line and get the same 409 at
once instead of a 403 or an unlock dialog over that agent's app. Once the
screen is its own (holder or reserved), its `/unlock` shows the dialog, and
its time stands still while the dialog is open; after a yes the 30 s start
over, after a no or no answer the screen passes on at once. An `/unlock` on
a free screen reserves it for the asking agent for the dialog's length, so
nobody drives over it. An `/app-access` that will show its question
(App access above) goes through the line the same way.

A turn another agent's message started (`startedByAgent`, from the
messages side) never takes a free screen and never joins the line: its
screen request gets 409 `screen_refused` ("a turn another agent's message
started can't take the screen; the user or your own earlier request in the
queue can"). It gets the screen only when the line hands it over: its
reservation, or a lease that began with one. A hand-over is never a
phone-control unlock: `ControlLock.unlockedFor` still applies, so in ask
mode the user's yes is still needed.

## Hands

Who has the phone's controls (`runner/presence/`, full builds only): the
agent driving (the lease above), or you after a hand-over. One hand-over at
a time per phone, of two kinds: **watch** (you drive; the agent still sees
the screen and keeps running) and **paused** (you drive; the agent can't
see, its run is stopped, and it goes on when you tap Start me again).
`Presence` is the one entry point and store (`PresenceStore`, pure
`HandsRules`); the glass, the app (`presenceAct`) and a notification call
`Presence.user(act)`.

- **Starting.** Your **Let me** (watch) or **Stop** (paused) works while an
  agent drives or holds the screen, and the hand-over is for that agent;
  Stop also turns a watch paused. An agent's `/hands/over {why, private?}`
  (`phone_hand_over`; `why` 1–120 characters) is a screen route: it must
  hold the screen or find it free and be unlocked (else the usual
  `control_busy` or `screen_refused`). Watch blocks up to 4 minutes and
  answers `{mode: "watch", back}`; private (paused) answers at once
  `{mode: "private", back: false, message}`. `/hands/wait {timeoutSec?}`
  (`phone_wait_for_user`, no arguments for agents; 1–240 s, default 240)
  blocks while you have the controls in watch (Let me: a pause) and
  answers `{back: true}` once you hand back, or at once when no hand-over
  is the caller's; its time run out, `back: false` with a `message` to
  call it again (one call per 4 minutes, the same turn). Stopped (Stop,
  at once, and a Stop ends a running wait) it answers `mode: "private"`
  with a `message` to end the turn: Stop really stops. The
  4 minutes sit under the MCP clients' tool timeouts (Codex's
  `tool_timeout_sec` and Claude Code's `MCP_TOOL_TIMEOUT` are raised to 5
  in their manifests). Both are full only and gated; a wait blocks on the
  request's own thread.
- **While it is on.** The agent's time on the screen stands still
  (`ScreenLease.promptOpened`, as for its unlock dialog) and nobody else is
  handed the screen. The router's `HandsGate`, after the lock and service
  checks and before the lease, turns screen routes away: for the agent the
  hand-over is for, watch lets `/pce/observe` through (with no lease claim)
  and answers anything else 409 `user_has_controls`; paused answers every
  screen route 409 `paused_by_user`, which tells it to end its turn. Your
  Stop also stops its turn at once where its kind can
  (`engine/stop/TurnStop`: an ACP turn is cancelled; a server engine with
  `chats.interrupt` has each chat `chats.active` names interrupted), and
  again at a screen call after the first in the same Stop
  (`PresenceStore.pausedCall`); an agent's own private hand-over is left
  alone, as it waits in it. Every other
  agent gets 409 `user_has_controls`; an agent's `/hands/over` while one is
  on gets it too. A run that ends meanwhile changes nothing: the screen
  stays with it (`Bridge.runEnded` holds back the lease's `runEnded`).
- **Ending.** **Your turn** (watch, `GIVE_BACK`): a waiting `/hands/over`
  or `/hands/wait` returns `back: true`; otherwise the resume note goes to
  the agent. **Start me again** (paused): the resume note, which sends it
  on in the same chat. **Go to app** (paused)
  opens the agent's chat in PhoneCanDo and changes nothing. **Leave**
  (paused): it stays stopped with no note; the screen goes back if its run
  ended, and its next run drives as normal. Its engine gone (`forget`) ends
  the hand-over with no note. The time starts over at the end
  (`promptClosed(keep = true)`).
- **The resume note** (`HandsText`, `Resume`): a running engine gets it as
  a runner notice that wakes it past its wake switch, budget and hop, like
  a scheduled task. One idle in a TUI that its own wake can't reach goes on
  in the same chat (`ResumeRules`), unless it left jobs running: a TUI that
  takes a first prompt is started again with the note (Codex); one that
  takes none starts in ACP mode with it, in the chat its terminal left,
  when its ACP mode lists its chats (Kimi Code; `AcpListing` keeps which
  kinds do, as each last started). Otherwise the note waits, unwoken, for
  its next turn (Gemini CLI, whose ACP mode would open a new chat). A
  stopped one is brought back as a run cut off is
  (`cutoff/BringRules`, in the chat it was in), or reads it when it next
  runs.

`/status {text, mood?}` (`agents_status`, every channel) sets the agent's
status line: one line, control characters out, at most 80 characters with
"…"; an empty text clears it; the same line again within 1 s is ignored;
it clears at run end, when its engine goes and after 15 minutes stale
(`StatusRules`). It answers `{shown: true}`. `agents_list` shows it per
agent (`status`), and the agent's notification shows it in place of a
working chat's "Working". `/focus {}` (`phone_focus`, every channel)
answers `{app: "front"|"back", onScreen: "your_chat"|"other_agent"|"app"|null,
phone: "unlocked"|"locked"|"off"}`.

### Driving overlay

While an agent drives (`ScreenLease.driver()`: the holder while
`inUse()`, but not while its own question waits for you: an unlock, an
app question) or has handed the phone to you, its own mascot lives on the
screen's walls over every app, the glass (`uiauto/overlay/`, full only;
`GlassOverlay` is `Presence.view`, which the accessibility service sets,
and Presence tells it each change of the frame). It draws natively from
the figures the app pushes for each agent (`MascotFigures`, laid out by
`mascot/`; plain A-01 until they come, `glass/figure/PlainFigures`), and
moves the pupils, the lids (blinks) and the squash itself. Where it sticks
and how it moves are pure (`presence/glass/`, JVM-tested): side on against
a side wall facing into the screen, hanging from the top edge or standing
on the bottom one. It peeks in from outside the phone, leaning round its
side wall's edge with only its eye showing, looks about, sees you and
ducks out, peeks again more warily, then hops in onto the wall
(`glass/walls/Entrance`, `Peek`; a pose may carry its own facing, eyes,
gaze and blink, `motion/Glance`); when nobody drives and nothing is
handed over it backs out the same way, with a last look (`Exit`).

- **Driving:** the edge glows red and breathes; the mascot says its status
  (`agents_status`) in a bubble in the card's look (`BubblePainter`: a
  square speech box, red edge, hard amber shadow, blocky tail), typed out
  in Geist Mono behind a blinking red cursor, popping as the words change,
  with three hopping amber blocks for the `thinking` mood. What it says to
  you after a button or your touch is a red bubble. It looks at each touch of the agent's and slides along its wall to
  stay level with it, never over it (`Dodge`). Tap it for **Let me** and
  **Stop** (`UserAct.LET_ME`, `STOP`).
- **Watching (WATCH):** it turns face on, the glow goes amber, and its sign
  says the agent's why (or "Your turn") with **Done** (`GIVE_BACK`).
- **Paused (PAUSED):** it turns its back, the glow goes off, "Not looking".
  After **I'm done** (the glass's own step) it slides to a bottom corner and
  sleeps with z's: **Start me again** (`START_AGAIN`), **Go to app** (opens
  its chat in PhoneCanDo, the pause kept) or a small **Leave it**
  (`LEAVE`: the screen goes at once, and a run still going stays off it,
  refused as paused, until that run ends; `PresenceStore.leftStopped`). A
  tap on it folds a sign away or brings it back.
- You can drag it and throw it: it lands on the wall the throw heads for.
  Paused, a bin comes up low in the middle as you drag (`glass/walls/Bin`,
  `BinPainter`); let go over it and it drops in: **Leave it**.
- **You touch the screen yourself** while it drives: that is **Let me**
  ("All yours, I'll watch"). A one-pixel watch window hears of every touch
  elsewhere (`TouchWatch`, `FLAG_WATCH_OUTSIDE_TOUCH`); the agent's own
  touches never count (the watch hears nothing while the glass lets them
  through, nor for 600 ms after), nor yours on the mascot or its card.

Its buttons call `Presence.user` off the main thread. It has three
accessibility overlay windows of our service, so no draw-over permission
is needed and Android lets touches through them to the app below: a
full-screen stage that never takes a touch (the mascot, glow, bubble), a
see-through grip over the mascot where it rests (14 dp wider all round
and at least 72 dp, so a tap near it never lands on the page), and the
card beside it: the app's look (`CardView`), a square speech box with a
red edge and a hard amber shadow whose tail points at the mascot
(`CardBack`), an amber kicker with a live light, and its buttons as the
app's keys (`KeyButton`: mono uppercase, the shadow they sink into when
pressed). It pops out of the mascot's side as it shows. Its mono face is
the app's Geist Mono, copied in as font resources by `theme.gradle`. The colours are `theme/tokens.json`'s, generated into resources by
`theme.gradle`; the mascot's dark ink (`theme_darkBg`) is the dark
theme's bg in both themes. Light or dark is the app's own theme setting
(System, Light or Dark: JS pushes it, `setGlassScheme`; `GlassScheme`
keeps it in prefs and themes the context the glass reads its colours
from), the phone's on System or until the app has said. A change
recolours the glass at once, the app's (`GlassScheme.listener`) or the
phone's (the service's `onConfigurationChanged`): `Palette.load`, the
card's words and keys again (`CardView.recolor`), the rest as it draws.

The agent never meets the glass (`uiauto/GuardedBackend.kt`, around the
PCE's backend). A screenshot is taken with every window see-through. A
tap, long press or swipe tells the glass where it lands first (its point,
a node's centre from the last snapshot, or a swipe's ends), so the mascot
can look and move away, then lands with the grip and card letting touches
through, because the backend taps even a node by a touch at its centre
first, and a touch goes to whatever window is on top. Each waits for a
drawn frame first. Our overlay windows are dropped from a snapshot's
window list. Typing, keys, scrolls and launches never touch the screen.

## Agent messages

Agents talk to each other through four routes (`AgentRoutes.kt`; the
messages, rules and delivery are `runner.md` → Messages), each a POST with
a JSON body, on every channel, neither gated by the phone-control lock nor
screen routes; the caller is the bearer's agent:

| Route | Body | `data` |
| --- | --- | --- |
| `/agents/list` | `{scope?: "machine"\|"phone"}` | `{you:{name, id, kind, machine}, scope, screen:{holder, reserved, waiting:[name], yourPlace}, agents:[{name, id, kind, machine:"yours"\|"other", machineMates, state:"working"\|"waiting"\|"idle"\|"stopped", chat, status:{text, mood}\|null, wakeable, canWake}]}` |
| `/agents/send` | `{to, text, replyTo?, wake?}` | `{id, results:[{to, status:"delivered"\|"queued"\|"woken"\|"refused", reason?}]}` |
| `/agents/inbox` | `{limit?}` (default 20, at most 50) | `{messages:[{id, from, kind, machine, sentAt, replyTo, text, notice}], more, note?}`, now read |
| `/agents/wait` | `{from?, timeoutSec?}` (at most 30) | the first new message as inbox, or `{timeout: true}` |

- `scope` "machine" (the default) lists the other agents on the caller's
  machine, "phone" every other agent. `kind` is the kind's label; `chat`
  the working chat's title, else the latest; `canWake` whether a direct
  message with `wake: true` would start its run now if it is idle, or
  start it if it is stopped (runner.md → Messages → Starting a stopped
  agent).
- `to` is an agent's name (any case) or id, `@machine` (every other agent
  on the caller's machine) or `@phone` (every other agent). A name two
  agents share is refused with both ids. Only a direct message may wake,
  and start a stopped agent. A refused send (a rate limit, a duplicate, an
  empty or too long text, a name nobody has) is its result with `id:
  null`, not an error; `reason` also says when a queued recipient gets it
  and, for an idle or stopped one, why it was not woken or started. An
  agent whose start for its message fails later gets a notice saying so.
- `note` says the messages are other AI agents', not the user's. A wait
  that names no known agent is 200 `ok:false` `unknown_agent`; a missing
  or mistyped argument is 400 `bad_request`.
- NanoHTTPD runs each connection on its own thread, so a wait (at most
  30 s) holds only its own request; the TS client gives it 40 s.

## Staying up

`/keep` (`KeepRoutes.kt`, the `agents_keep_running` tool) is the calling
agent asking to stay up while idle in the background, or taking that back
(`runner.md` → Jobs and the idle stop). A POST on every channel, neither
gated nor a screen route: it changes nothing on the phone.

| Body | `data` |
| --- | --- |
| `{on: true, reason, minutes?}` | `{on: true, reason, minutes, until, userKeepsRunning}` |
| `{on: false}` | `{on: false, userKeepsRunning}` |

`reason` is one line the user sees in the notification (cut to 120
characters); `minutes` defaults to 30 and is cut to 1–120; a new ask
replaces the last. `until` is ISO-8601 UTC. `userKeepsRunning`: the user's
Keep running switch is on, so the agent needs no ask. A missing `on`, a
missing or blank `reason` with `on: true`, or a mistyped argument is 400
`bad_request`.

## Schedules

`/schedule/add|list|cancel` (`ScheduleRoutes.kt`, the `schedule_add`,
`schedule_list` and `schedule_cancel` tools) let the calling agent set
tasks for itself, later or again (`runner.md` → Schedules). Only for
itself: there is no `agent` argument, and it reaches other agents with
`agents_send`. POSTs on every channel, neither gated nor screen routes: a
task runs as the agent's own turn.

| Route | Body | `data` |
| --- | --- | --- |
| `/schedule/add` | `{text, at? \| in? \| every? \| daily?, days?, chat?}` | `{id, nextAt, nextAtText, timing, chat, zone}` |
| `/schedule/list` | `{}` | `{now, zone, schedules:[{id, text, timing, nextAt, chat, on, by}]}` |
| `/schedule/cancel` | `{id}` | `{id, cancelled: true}` |

Exactly one of `at` (ISO-8601; without an offset it is the phone's local
time), `in` (whole minutes from now, 1 to 527040), `every` (whole minutes,
15 to 527040; the first run that far from now) or `daily` (`"HH:MM"`, with
`days` `["mon".."sun"]` to keep it to some weekdays). `chat` is `new` or
`same`: by default same for `at` and `in`, new for `every` and `daily`.
Times answer as ISO-8601 with the phone's offset (`nextAt` null once it
will not run again), `nextAtText` as the phone shows a time, `timing` as
words ("every 30 min", "Mon, Fri at 09:00"), `zone` the phone's zone id.
Refusals: 400 `bad_request` (a missing or mistyped argument, a time in the
past or over 366 days ahead), 403 `not_allowed` (the user switched off
"Can schedule itself" for the agent, a kind that cannot run tasks, or
cancelling one the user set), 404 `not_found` (no schedule of the
caller's with that id), 409 `limit` (20 schedules per agent, 10 set by the
agent).

## Agent-side tools

The tools are kind-neutral: `agents/shared/phone-tools/`
holds their names, descriptions, schemas and the bridge client
(`client.ts`), and is packaged inside each kind's config. opencode registers
them through thin plugin adapters: `plugins/phone/index.ts` registers the
seven basic tools every channel gets
(`phone_ping/battery/notify/focus/share/open/clipboard`); `plugins/automation/index.ts`,
shipped only in full, registers phone control (`phone-tools/control/`),
`phone_return` (`/app`), `phone_request_unlock` (`/unlock`),
`phone_ask_app` (`/app-access`), `phone_open_accessibility`
(`/accessibility`), `phone_hand_over`
(`/hands/over`) and `phone_wait_for_user` (`/hands/wait`). Both go through
`plugins/phone/opencode.ts` (`Plugin.define` + `ctx.tool.transform`).
The agent messages' tools, `agents_list`, `agents_send`, `agents_inbox` and
`agents_wait` (`agents.ts`, one route each), `agents_status` (`/status`),
`agents_keep_running`
(`keep.ts`, `/keep`) and `schedule_add`, `schedule_list` and
`schedule_cancel` (`schedule.ts`, `/schedule/*`) are on every channel.
The client uses a 15 s timeout by default, 40 s for the 30 s waits
(`agents_wait`, `phone_hand_over`, `phone_wait_for_user`), 50 s for unlock,
135 s for `phone_ask_app`, whose bridge wait is 120 s, and 255 s for
accessibility, whose bridge wait is 240 s, and degrades to a message when
the bridge is absent. `phone_act` derives its timeout from the call, so a
long wait ends in the bridge's own result rather than a client timeout:
`timeoutMs` (clamped to 1–120 s, default 30 s) plus, with `expect`,
`expectTimeoutMs` (0.5–30 s, default 5 s) plus 10 s, capped at 280 s.

The full tool surface is in `../../../docs/api/tools.md`; wrapper parity and device proof
are in `../modules/automation.md`.

## MCP

`POST /mcp` serves the phone tools to any agent that speaks MCP
(Streamable HTTP), with the same bearer token as the HTTP routes
(`runner/bridge/mcp/`). It is stateless: each POST carries one JSON-RPC
message and gets one JSON answer, with no SSE stream and no session id, so
GET and DELETE answer 405.

- Methods: `initialize`, `ping`, `tools/list` and `tools/call`.
  `initialize` echoes the client's `protocolVersion` when we know it
  (`2025-11-25`, `2025-06-18`, `2025-03-26`; a stateless tools-only server
  behaves the same under each) and otherwise answers our latest, with
  `capabilities.tools` and `serverInfo` `phonecando` at the app version.
  Any other method is JSON-RPC `-32601` in a 200, so a client's probe
  (Claude Code first sends `server/discover` for a newer protocol) falls
  back instead of failing. Notifications (`notifications/initialized`
  among them) and client responses get 202 with no body. A body that is
  not one JSON-RPC message (bad JSON, a batch, no `jsonrpc: "2.0"`, a null
  id) is 400 with an id-less error.
- Headers: an `Origin`, when sent, must be loopback (403 otherwise; a page
  in a browser must not reach the bridge). `MCP-Protocol-Version` is not
  checked, since every version is answered alike.
- `tools/call` runs the tool's one route through `BridgeRouter`, the router
  every HTTP call goes through, so the channel, the switch, the service,
  the screen lease and the prompts apply exactly as they do there, and the
  call counts in telemetry under its route. The route's body is the tool's
  fixed fields plus each argument its schema names (a null argument counts
  as absent). The reply becomes one text item worded as `client.ts` words
  it: the data as JSON, or `error <code>: <message>` with `isError: true`,
  the bridge's refusals included (`automation_off`, `control_busy` with the
  caller's place in line and a message to come, `screen_refused`,
  `automation_unavailable`, `app_not_allowed` naming the package to ask
  about): the model acts on them as it does in the
  agent's own plugin. MCP cannot push into a chat, so when the caller has
  unread agent messages, every result (refusals too) gets a second text
  item, `You have N unread agent messages: call agents_inbox.`
  (`UnreadLine.kt`, counted after the call). An unknown tool, a full-only
  one on lite/play among them, is JSON-RPC `-32602`.
- The tool table is `agents/shared/phone-tools/tools.json`, generated from
  the TS tools by `node agents/shared/phone-tools/gen-tools-json.mjs`
  (`--check` fails when it is stale; `pnpm -C agents check` runs it). The
  generator traces each tool's `run` against a stub bridge and keeps a tool
  only when it is one pass-through call to one route. The composed
  wrappers (`phone_launch/screen/info/click/tap/text/scroll/swipe/back/home/wait`,
  `control/composed.ts`) chain `/pce/observe` and `/pce/act` or build on a
  snapshot in TypeScript, so they are left out, each listed under `omitted`
  with its reason; over MCP an agent uses `phone_observe` and `phone_act`.
  agents.gradle packages the table as the asset of the same path; the
  bridge serves its `channel: "full"` tools only in full builds, and a
  build without the table serves MCP with no tools.
- Long waits: `phone_open_accessibility` holds the call up to 240 s,
  `phone_ask_app` up to 120 s, `phone_request_unlock` up to 45 s and
  `agents_wait` up to 30 s. An MCP
  client with a shorter request timeout gives up first; the prompt itself
  stays up in the app.

## Trust gate

The phone-control lock (`controllock/ControlLock`, one per process via
`ControlLocks`) decides per calling agent. Its mode, picked in Settings →
Phone control, says how long an unlock lasts:

- `install` (default): one switch for the phone, kept across restarts until
  the user locks it.
- `launch`: one switch, in memory; it ends with the process or when the user
  closes PhoneCanDo (the activity finishes: swiped from recents).
- `ask`: no switch. The user's yes to an agent's `/unlock` is that agent's
  own unlock (`AskGrants`); it ends at the agent's `/app` (`phone_return`),
  when its engine stops (`BridgeHandle.agentGone`), after 5 minutes with no
  gated call from it, or when the user locks. Other agents stay locked and
  ask for themselves.

Settings or the in-chat unlock modal unlocks only after
`expo-local-authentication` succeeds (screen-lock PIN, pattern or password
when there is no biometric; a phone with no screen lock cannot unlock).
Changing the mode asks too, in either direction, because an agent with
phone control could tap the picker. Agents run as the app's Linux user and
can write its files, so the saved mode and the install-mode unlock are
records signed with Android Keystore keys that sign only within 15 s of a
fingerprint (strong biometric) or the screen lock (`KeystoreLockStore`):
each save makes a new key, so a copied older record fails; a mode record
that fails reads as `ask`, and no key at all as a fresh install's `install`.

Locked calls to `notify/share/open/clipboard/pce/*` return 403
`automation_off` in full builds; when the lock lets the agent in but the
service is not enabled in Android settings, `/pce/*` returns 503
`automation_unavailable`, also when the service disconnects between the
bridge's check and the call (the agent's cue to call
`phone_open_accessibility`). `/app` stays ungated: own-app launch is safe
even while locked. Past the lock, each app an agent reaches needs the
user's yes too (App access above). `/unlock`, `/accessibility`,
`/app-access` and `/pce/*` exist only in full builds; lite/play return 404
`not_found` for them.

Lite/play builds have no accessibility host and no switch, so the six basic
tools stay available (and the UI/PCE tools are not registered). `/ping` reports
`channel`, `unlocked` (for the calling agent), `pce`, and the `ui` compatibility alias so the agent can
explain what is missing. The engine launcher injects
`PHONECANDO_CHANNEL=full|lite|play` into every engine's env; the agent asset
also omits the full-only automation plugin and phone-control tools outside
full. Full builds register the seven basic tools and the nine agent and
schedule tools, plus `phone_return`, `phone_request_unlock`,
`phone_ask_app`, `phone_open_accessibility`, `phone_hand_over` and
`phone_wait_for_user`, the four PCE tools
`phone_describe`/`observe`/`act`/`pack`, the `phone_launch` package launcher,
and the legacy screen/info/click/tap/text/scroll/swipe/back/home/wait wrappers
(37 tools total; 26 over MCP, which leaves out the 11 composed ones).
Lite/play get the seven basic tools and the nine agent and schedule tools
(16).

### No agent asks about our tools

The lock above is the only check on our own tools (`phone_*`, `agents_*`,
`schedule_*`): no agent waits on its own approval prompt before calling one.
An agent's own tools (shell, file edits, other MCP servers) still ask as its
settings say.

- ACP mode: the runner answers a permission question about one of our tools
  allow-once itself (`engine/acp/OwnTools`, see runner.md), so it never
  reaches you.
- TUI mode: each kind that loads our MCP server also loads a setting that
  trusts that one server, named in its manifest's `phoneToolsTrust` (the
  launch argv or a file in its config folder, and the text that must be
  there); the kit refuses a bundled kind with MCP phone tools and no trust.
- opencode: plugin tools called through Code Mode's `execute` never hit its
  `permissions` rules (verified on 2.0.26), so it needs no setting.

## Build channels

One codebase, three channels, one Gradle project: channels are product
flavors on the `channel` dimension (`pnpm android:<channel>` builds the
`<channel>Debug` variant; the release scripts build `assembleFullRelease
assembleLiteRelease` in one Gradle run). Library modules without the
dimension (React Native, Expo, Reanimated, the terminal) compile once and are
shared; only the app module, `phonecando-runner` and `phonecando-linux`
differ per flavor.

| Channel | Phone control | Linux images | Self-update | `REQUEST_INSTALL_PACKAGES` |
| --- | --- | --- | --- | --- |
| `full` | accessibility + PCE | yes | GitHub Releases | yes |
| `lite` | none | yes | GitHub Releases (offers `full`) | yes |
| `play` | none | none (Android env only) | Play-managed | no |

Lite and full share the package name and signing key. Lite is pinned to
`versionCode` 1 so any full release replaces it and no lite can ever replace
an installed full. Lite is the site download because Play Protect blocks
full from a browser; see `docs/release/upgrade-test.md`. `SYSTEM_ALERT_WINDOW` is not used by any channel and is stripped; the driving overlay is the accessibility service's own overlay window type, which needs no permission.

`plugins/withBuildChannel.js` declares the flavors in `app/build.gradle`
(lite pins `versionCode 1`), fills the `com.phonecando.channel` meta-data
from a per-flavor manifest placeholder, writes the accessibility service into
the `src/full/AndroidManifest.xml` overlay and a `tools:node="remove"` for
`REQUEST_INSTALL_PACKAGES` into `src/play/`, and strips
`BIND_ACCESSIBILITY_SERVICE` plus `SYSTEM_ALERT_WINDOW` from the main
manifest. The runner module declares the same dimension: its `full` source
set adds `src/uiauto/java` + `src/uiauto/res`, the PCE dependencies are
`fullImplementation`, `consumer-rules-full.pro` keeps `FullAutomation` (which
`AutomationHost.kt` finds by reflection and caches, a miss included) should
the app ever minify, and `syncAgentConfig<Variant>` tasks stage a per-variant
agent config (lite/play omit the automation plugin and `phone-tools/control/`
and use the lite `AGENTS.md`), registered with `addGeneratedSourceDirectory`
so the Android plugin orders every asset reader after them.
`withPceCompositeBuild.js` always includes the PCE build; only the full
flavor resolves it. `phonecando-linux` declares the dimension too: play
builds no launcher and packages no proot libs or Default image.

JS reads the channel with `getBuildChannel()` (`full` when the native fn is
absent — Expo Go / pre-channel installs); Settings → About shows it. The
self-updater returns null only for `play`. Every full-only component must gate
on `full`. Rationale: Play bans autonomous a11y agents, so Play carries no
automation trace while sideload/GitHub keeps full power.

APK audit checklist (run after each channel build): no
`com.phonecando.pce`, `com.phonecando.runner.uiauto` or
`com.phonecando.runner.packs` classes in any dex for lite/play; no driver
service or `accessibility_config` resource; no `BIND_ACCESSIBILITY_SERVICE`;
no `SYSTEM_ALERT_WINDOW`; and no `REQUEST_INSTALL_PACKAGES` in `play`.

## Related

- PCE routes and host adapter: `automation.md`
- Tool contract: `../../../docs/api/tools.md`
- Security model: `../../../docs/api/security.md`
- Errors: `../../../docs/api/errors.md`
