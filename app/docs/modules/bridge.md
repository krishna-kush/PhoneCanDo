# Loopback bridge and mobile tools

The host bridge exposes `mobile_*` tools to the agent. It is loopback-only and
runs in the foreground service beside `serve`.

## Endpoints and envelope

- `BridgeServer.kt` uses NanoHTTPD (MIT) for HTTP framing; no hand-rolled
  parser. It binds `127.0.0.1:9998` (free loopback port if squatted).
- Install-stable bearer in prefs (`bridge_token`), handed to serve as
  `PHONECANDO_BRIDGE_URL` + `PHONECANDO_BRIDGE_TOKEN` (env only, never a config
  file).
- Endpoints: `ping/battery/notify/share/open/clipboard/app/unlock/accessibility`
  plus the automation `/pce/*` routes.
- Envelope: `{ok:true,data}` or `{ok:false,code,message}`. A bad token returns
  401; app-level failures return 200 + `ok:false`.
- `open`/`share` start activities, so they work only while the app is
  foreground; clipboard reads report `available:false` to background apps
  (API 29+).
- `/app` is ungated on purpose: it only launches PhoneCanDo's own activity with
  an optional `home|env|settings` tab, hands the tab to JS through prefs plus a
  native event, and posts a tap-to-return notification when backgrounded.
- `/unlock` is also ungated: it asks the app to show its biometric/PIN modal
  over the chat, then blocks until the app resolves the request (or the 45s
  timeout) so the agent can continue in the same turn. The modal is the only
  place the gate flips; the agent never sees a credential.
- `/accessibility` is ungated and first asks the app to show an in-chat
  confirmation (`AccessibilityDialog`). Only after the user taps **Open
  settings** does the app open Android's Accessibility screen; the bridge then
  waits for `PceAuto.service` to connect. The user must flip the system toggle;
  the agent cannot. If the wait times out, the agent asks the user to say when
  done and checks `/ping` (`pce`; `ui` is a compatibility alias). `/ping`
  reports the flavor, lock, and PCE state.

## Agent-side tools

`plugins/mobile/index.ts` registers the tools via `ctx.tool.transform` (15s
timeout by default, 50s for unlock, 65s for accessibility; degrades to a
message when the bridge is absent). `mobile_return` wraps `/app`;
`mobile_request_unlock` wraps `/unlock`; `mobile_open_accessibility` wraps
`/accessibility`.

The full tool surface is in `../../../docs/api/tools.md`; wrapper parity and device proof
are in `../modules/automation.md`.

## Trust gate

`AutomationGate.enabled` is in-memory, default off, and resets with the app
process. Settings → Phone control or the in-chat unlock modal flips it only
after `expo-local-authentication` succeeds (device credential fallback
allowed). Locked calls to `notify/share/open/clipboard/pce/*` return 403
`automation_off` in full builds; with the switch on but the service not
enabled in Android settings, `/pce/*` returns 503 `automation_unavailable`.
`/app`, `/unlock`, and `/accessibility` stay ungated: own-app launch, the
user's biometric/accessibility modals, and the system accessibility screen are
safe even while locked.

Play builds have no accessibility host and no switch, so the six basic tools
stay available (and the UI/PCE tools are not registered). `/ping` reports
`unlocked`, `pce`, and the `ui` compatibility alias so the agent can explain
what is missing. The service injects `PHONECANDO_AUTOMATION=full|play` into the
opencode env; play builds register only the six basic tools (the accessibility
host and PCE are absent, so automation tools would only fail). Full builds
register three extra non-driver tools, `mobile_return`,
`mobile_request_unlock`, and `mobile_open_accessibility`, plus the four PCE
tools `mobile_describe`/`observe`/`act`/`pack`, the `mobile_launch` package
launcher, and the legacy screen/info/click/tap/text/scroll/swipe/back/home/wait
wrappers (24 tools total).

### Trust gate caveat

Verified on device: opencode 2.0.26 has no `ctx.permission.assert` (newer v2 docs
describe it), and plugin tools invoked through Code Mode's `execute` never hit
top-level `permissions` rules, so a `mobile_*` ask rule is inert in this build.
Per-call prompts return when opencode is bumped; until then the app-side
master switch (biometric, default off) is the gate.

## Build flavors

One codebase, two APKs. `PHONECANDO_AUTOMATION=full` (default,
`pnpm android:full`) ships the automation driver; `=play`
(`pnpm android:play`) strips it via `plugins/withAutomationFlag.js` (removes
the driver service + `BIND_ACCESSIBILITY_SERVICE`, bakes a
`com.phonecando.automation` meta-data flag). JS reads it via
`isAutomationBuild()` (`full` when the native fn is absent — Expo Go /
pre-flag installs); Settings → About shows it. Every Slice-2 component
(service, bridge automation endpoints, automation UI) must gate on this flag.
Rationale: Play bans autonomous a11y agents, so the Play build carries no
automation trace while sideload/F-Droid keeps full power.

`withAutomationFlag.js` writes `phonecando.automation=full|play` into
`gradle.properties` at prebuild (env vars go stale in a reused Gradle daemon),
declares the service in the app manifest only for `full`, and the module's
`sourceSets` include `src/uiauto/java` + `src/uiauto/res` only when the property
is not `play`. APK audited 2026-10-30: no `com.phonecando.pce`,
`com.phonecando.runner.uiauto` or `com.phonecando.runner.packs` classes in any dex, no
driver service, no `accessibility_config` resource, and no
`BIND_ACCESSIBILITY_SERVICE`.

## Related

- PCE routes and host adapter: `automation.md`
- Tool contract: `../../../docs/api/tools.md`
- Security model: `../../../docs/api/security.md`
- Errors: `../../../docs/api/errors.md`
