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
  dialog (`ui/accessibility/AccessibilityDialog.tsx`; with the
  restricted-settings guide, `RESTRICTED_FLOW` in `guide.ts`, it walks
  Android's "Restricted setting" message, App info → Allow restricted
  settings and the switch; see `runner.md`). The bridge then waits up to
  `waitMs` (default 240 s, capped under five minutes where HTTP clients give
  up) for `PceAuto.service` to connect, so the agent carries on by itself
  once the switch is on. "Not now" in the dialog ends the wait at once
  (`cancelled:true`). A second `/accessibility` request takes over the
  dialog, so "Not now" reaches only the newer one; the earlier request
  returns at once with `superseded:true` (not `cancelled`). The response is
  `{opened, enabled, cancelled, superseded, notified, restricted}`;
  `restricted` is `sideload` when the user went through the
  guide, else the native guess (`RestrictedSettings.state`). The user must
  flip the system toggle; the agent cannot. On `enabled:false` the agent tells the user
  to follow the steps in the app and checks `/ping` (`pce`; `ui` is a
  compatibility alias) when they say done. `/ping` reports the flavor, lock,
  and PCE state.

## Agent-side tools

`plugins/mobile/index.ts` registers the six basic tools every channel gets
(`mobile_ping/battery/notify/share/open/clipboard`); `plugins/automation/index.ts`,
shipped only in full, registers phone control, `mobile_return` (`/app`),
`mobile_request_unlock` (`/unlock`) and `mobile_open_accessibility`
(`/accessibility`). Both register via `ctx.tool.transform` through
`mobile/shared.ts` (15s client timeout by default, 50s for unlock, 255s for
accessibility, whose bridge wait is 240s; degrades to a message when the
bridge is absent). `mobile_act` derives its timeout from the call, so a long
wait ends in the bridge's own result rather than a client timeout: `timeoutMs`
(clamped to 1–120 s, default 30 s) plus, with `expect`, `expectTimeoutMs`
(0.5–30 s, default 5 s) plus 10 s, capped at 280 s.

The full tool surface is in `../../../docs/api/tools.md`; wrapper parity and device proof
are in `../modules/automation.md`.

## Trust gate

`AutomationGate.enabled` is in-memory, default off, and resets with the app
process. Settings → Phone control or the in-chat unlock modal flips it only
after `expo-local-authentication` succeeds (device credential fallback
allowed). Locked calls to `notify/share/open/clipboard/pce/*` return 403
`automation_off` in full builds; with the switch on but the service not
enabled in Android settings, `/pce/*` returns 503 `automation_unavailable`,
also when the service disconnects between the bridge's check and the call
(the agent's cue to call `mobile_open_accessibility`).
`/app` stays ungated: own-app launch is safe even while locked. `/unlock`,
`/accessibility` and `/pce/*` exist only in full builds; lite/play return 404
`not_found` for them.

Lite/play builds have no accessibility host and no switch, so the six basic
tools stay available (and the UI/PCE tools are not registered). `/ping` reports
`channel`, `unlocked`, `pce`, and the `ui` compatibility alias so the agent can
explain what is missing. The service injects `PHONECANDO_CHANNEL=full|lite|play`
into the opencode env; the agent asset also omits the full-only automation
plugin outside full. Full builds register the base six tools plus three extra
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
shared; only the app module and `phonecando-runner` differ per flavor.

| Channel | Phone control | Self-update | `REQUEST_INSTALL_PACKAGES` |
| --- | --- | --- | --- |
| `full` | accessibility + PCE | GitHub Releases | yes |
| `lite` | none | GitHub Releases (offers `full`) | yes |
| `play` | none | Play-managed | no |

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
agent config (lite/play omit the automation plugin and use the lite
`AGENTS.md`), registered with `addGeneratedSourceDirectory` so the Android
plugin orders every asset reader after them. `withPceCompositeBuild.js` always includes the PCE build; only
the full flavor resolves it.

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
