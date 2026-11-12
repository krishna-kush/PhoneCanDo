# Loopback bridge and mobile tools

The host bridge exposes `mobile_*` tools to every running agent. It is
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
  (503 `automation_unavailable`), the JSON body (400), the screen lease (409
  `control_busy`, full builds only), then the handler. A refused request
  never takes the lease. `Routes.kt` lists every route with its guards.
- Endpoints: `ping/battery/notify/share/open/clipboard/app/unlock/accessibility`
  plus the automation `/pce/*` routes, and `/mcp`, the same tools over MCP
  (below). Bodies over 256 KB return 413. `BridgeServer.kt` only frames
  HTTP; `BridgeEntry.kt` checks the token (before the body is even read),
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
  false when Android shows no notifications for the app.
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

`/unlock` and `/accessibility` (full builds only, ungated) ask the user
something for one request and block until the answer, so the agent carries
on in the same turn (`PromptRoutes.kt`, `PromptFlows.kt`). Each request
registers its own prompt (`PromptRegistry.kt`: request id, kind, agent id
and name, reason) and waits on it alone, so a second agent's request never
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

## Screen lease

Several agents can run at once, but one drives the screen at a time
(`ScreenLease.kt`, full builds only). The PCE keeps one current snapshot per
phone, so another agent's observe would invalidate the first one's snapshot
ids, and a long act holds the PCE lane. The first agent to call a screen
route (`/pce/observe`, `/pce/act`, `/pce/pack`, `/open`, `/share`, `/app`)
holds the screen until it has been idle for 30 s, counted from the end of
its last screen request; its own requests always pass, so observe then act
cannot be split by another agent. Others get 409 `control_busy` with the
holder's name and `retryAfterMs`, and the tool tells the model to wait and
try again rather than loop. The lease ends early when the holder's agent is
deleted, or when the holder calls `/app` (`mobile_return`, done with the
phone). `/ping`, `/battery`, `/notify`, `/clipboard`, `/pce/describe` and
the prompts are not screen routes. Lite and play have no driver, so they
take no lease.

## Agent-side tools

The tools are kind-neutral: `agents/shared/phone-tools/`
holds their names, descriptions, schemas and the bridge client
(`client.ts`), and is packaged inside each kind's config. opencode registers
them through thin plugin adapters: `plugins/mobile/index.ts` registers the
six basic tools every channel gets
(`mobile_ping/battery/notify/share/open/clipboard`); `plugins/automation/index.ts`,
shipped only in full, registers phone control (`phone-tools/control/`),
`mobile_return` (`/app`), `mobile_request_unlock` (`/unlock`) and
`mobile_open_accessibility` (`/accessibility`). Both go through
`plugins/mobile/opencode.ts` (`Plugin.define` + `ctx.tool.transform`).
The client uses a 15 s timeout by default, 50 s for unlock and 255 s for
accessibility, whose bridge wait is 240 s, and degrades to a message when
the bridge is absent. `mobile_act` derives its timeout from the call, so a
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
  wait, `automation_unavailable`): the model acts on them as it does in the
  agent's own plugin. An unknown tool, a full-only one on lite/play among
  them, is JSON-RPC `-32602`.
- The tool table is `agents/shared/phone-tools/tools.json`, generated from
  the TS tools by `node agents/shared/phone-tools/gen-tools-json.mjs`
  (`--check` fails when it is stale; `pnpm -C agents check` runs it). The
  generator traces each tool's `run` against a stub bridge and keeps a tool
  only when it is one pass-through call to one route. The composed
  wrappers (`mobile_launch/screen/info/click/tap/text/scroll/swipe/back/home/wait`,
  `control/composed.ts`) chain `/pce/observe` and `/pce/act` or build on a
  snapshot in TypeScript, so they are left out, each listed under `omitted`
  with its reason; over MCP an agent uses `mobile_observe` and `mobile_act`.
  agents.gradle packages the table as the asset of the same path; the
  bridge serves its `channel: "full"` tools only in full builds, and a
  build without the table serves MCP with no tools.
- Long waits: `mobile_open_accessibility` holds the call up to 240 s and
  `mobile_request_unlock` up to 45 s. An MCP client with a shorter request
  timeout gives up first; the prompt itself stays up in the app.

## Trust gate

The phone-control lock (`controllock/ControlLock`, one per process via
`ControlLocks`) decides per calling agent. Its mode, picked in Settings →
Phone control, says how long an unlock lasts:

- `install` (default): one switch for the phone, kept across restarts until
  the user locks it.
- `launch`: one switch, in memory; it ends with the process or when the user
  closes PhoneCanDo (the activity finishes: swiped from recents).
- `ask`: no switch. The user's yes to an agent's `/unlock` is that agent's
  own unlock (`AskGrants`); it ends at the agent's `/app` (`mobile_return`),
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
`mobile_open_accessibility`). `/app` stays ungated: own-app launch is safe
even while locked. `/unlock`, `/accessibility` and `/pce/*` exist only in
full builds; lite/play return 404 `not_found` for them.

Lite/play builds have no accessibility host and no switch, so the six basic
tools stay available (and the UI/PCE tools are not registered). `/ping` reports
`channel`, `unlocked` (for the calling agent), `pce`, and the `ui` compatibility alias so the agent can
explain what is missing. The engine launcher injects
`PHONECANDO_CHANNEL=full|lite|play` into every engine's env; the agent asset
also omits the full-only automation plugin and phone-control tools outside
full. Full builds register the base six tools plus three extra
non-driver tools, `mobile_return`, `mobile_request_unlock`, and
`mobile_open_accessibility`, the four PCE tools
`mobile_describe`/`observe`/`act`/`pack`, the `mobile_launch` package launcher,
and the legacy screen/info/click/tap/text/scroll/swipe/back/home/wait wrappers
(24 tools total). Lite/play get the base six only.

### Trust gate caveat

Verified on device: opencode 2.0.26 has no `ctx.permission.assert` (newer v2 docs
describe it), and plugin tools invoked through Code Mode's `execute` never hit
top-level `permissions` rules, so a `mobile_*` ask rule is inert in this build.
Per-call prompts return when opencode is bumped; until then the app-side
master switch (biometric, default off) is the gate.

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
full from a browser; see `docs/release/upgrade-test.md`. `SYSTEM_ALERT_WINDOW` is not used by any channel and is stripped.

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
