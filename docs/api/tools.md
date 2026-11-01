# AI tools

Keep the existing `mobile_*` namespace. Add verbs; do not rename what the
agent already knows.

| Tool | Purpose |
|---|---|
| `mobile_describe` | contract, pce, device, backends, action catalog, limits, installed packs |
| `mobile_observe` | one compact snapshot: tree + windows + meta + optional screenshot |
| `mobile_act` | one action against a snapshot (simple cases) |
| `mobile_launch` | launch an installed app by package name (PCE launch action) |
| `mobile_execute` | batch/DSL with per-step expect, retry, timeout |
| `mobile_flow` | list/run/save a named app flow from a pack |
| `mobile_pack` | list/refresh/rollback packs; run a flow |
| `mobile_doctor` | a11y, Shizuku, keyguard, screen, IME, rotation, packs, bridge, trace |

The table is the contract target. The current build registers the existing
wrappers plus `mobile_describe/observe/act/launch/pack`; status is in
`../../app/docs/modules/automation.md`.

`mobile_screenshot` is not registered. Request an observation screenshot with
`mobile_observe({screenshot: true})`; the PCE's explicit `Action.Screenshot`
stays reserved until `Backend.execute` can return an artifact.

Existing `mobile_ping/battery/notify/share/open/clipboard` and the legacy
automation wrappers (`mobile_screen`, `mobile_info`, `mobile_click`,
`mobile_tap`, `mobile_text`, `mobile_scroll`, `mobile_swipe`, `mobile_back`,
`mobile_home`, `mobile_wait`, `mobile_return`, `mobile_request_unlock`,
`mobile_open_accessibility`) remain and are deprecated only when the contract
version changes. The screen/info/.../wait wrappers now call `/pce/observe` and
`/pce/act` directly; `/ui/*` is gone. `mobile_launch` is the package launcher;
`mobile_open` stays URL-only and rejects app schemes.

Implementation status, wrapper parity and device proof are in
`../../app/docs/modules/automation.md`.

## `mobile_describe`

```json
{
  "contract": "1.0",
  "pce": "1.0.0",
  "device": {"sdk": 36, "model": "test device", "display": [1080, 2400], "rotation": 0},
  "backends": {
    "a11y": {"available": true},
    "shizuku": {"available": false, "reason": "not_installed"},
    "vision": {"available": true, "model": "multimodal"}
  },
  "limits": {"maxSteps": 50, "maxNodes": 400, "screenshot": true, "secureWindows": false},
  "actions": [
    {"id": "tap", "risk": "low", "backends": ["a11y", "shizuku"], "timeoutMs": 5000}
  ],
  "packs": [
    {"id": "com.zepto", "version": 3, "appVersionCode": 123, "status": "active"}
  ]
}
```

The AI reads this to know what it can do on this device before planning.
Current builds report `vision.available: false`; the example shows the target
shape.

## `mobile_observe`

See `snapshots.md` for the full payload and rules.

## `mobile_act`

```json
{
  "snapshotId": 42,
  "action": {"tap": {"i": 7}},
  "expect": {"text": "Search"},
  "timeoutMs": 5000,
  "retry": 1
}
```

## `mobile_execute`

```json
{
  "steps": [
    {"launch": "com.zepto"},
    {"wait": {"text": "Search", "timeout": 8000}},
    {"tap": {"text": "Search"}},
    {"type": {"text": "milk"}},
    {"key": "enter"},
    {"expect": {"text": "Add", "timeout": 8000}},
    {"tap": {"text": "Add", "index": 0}},
    {"screenshot": true}
  ]
}
```

Each step supports `timeoutMs`, `retry`, `expect`, `onFail`
(`stop|continue`), and `risk`. The PCE executes the batch in one call.
The model does not sleep or re-observe between every step.

## `mobile_flow`

```json
{"action": "run", "id": "zepto.search", "params": {"query": "milk"}}
```

Flows are named, parameterized step lists stored in packs. The current build
runs one with
`mobile_pack {"action":"run","id":"<pack>","flow":"<flow>","params":{...}}`;
the dedicated `mobile_flow` tool and flow saving are still
target surface. The AI can run a known-good flow, or author one and save it
with `{"action":"save", ...}` once that lands.
