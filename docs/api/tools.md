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

## Hands, status and focus

Handing the user the phone's controls (full only, gated) and reaching
them (every channel, outside the lock); one bridge route each
(`../../app/docs/modules/bridge.md` → Hands):

| Tool | Route | Purpose |
|---|---|---|
| `mobile_hand_over` | `POST /hands/over` | give the user the controls with a `why` they see: watch (their input; you follow with `mobile_observe`, it waits up to 30 s for `back`) or `private: true` (passwords, payments, 2FA, permission screens: you can't see the screen; end your turn and get a message when they hand it back) |
| `mobile_wait_for_user` | `POST /hands/wait` | no arguments: wait up to 4 minutes a call while the user drives and you watch (a watch hand-over, or Let me), in the same turn; `back: false` in watch: call it again; `mode: "private"`: they stopped you, end the turn |
| `mobile_focus` | `POST /focus` | where the user looks: `app` front or back, `onScreen` your chat, another agent's, another page or null, `phone` unlocked, locked or off |
| `mobile_notify` | `POST /notify` | reach the user away from your chat; nothing while your chat is on screen (`posted: false`), one a minute and five an hour (429 `notify_too_often`) |
| `agents_status` | `POST /status` | a few words on what you do now, with a `mood` (working, thinking, waiting); your mascot and `agents_list` show it, an empty text clears it. While driving the phone, set it before each step so the user can follow |

## Agent tools

Messages between the AI agents on the phone, an agent's ask to stay up
and its tasks for later, on every channel and outside the phone-control
lock (`agents/shared/phone-tools/agents.ts`, `keep.ts` and `schedule.ts`;
one bridge route each, so MCP serves them too):

| Tool | Route | Purpose |
|---|---|---|
| `agents_list` | `POST /agents/list` | who is here (`scope` machine or phone), what each does (its state, chat and status line), who holds or waits for the screen |
| `agents_send` | `POST /agents/send` | a message to an agent by name, `@machine` or `@phone`; `wake: true` (direct only) wakes an idle one, or starts a stopped one; an answer (`replyTo`) to a message that woke you wakes its sender |
| `agents_inbox` | `POST /agents/inbox` | read and mark read the caller's unread messages and notices |
| `agents_wait` | `POST /agents/wait` | wait up to 30 s for the next message (`from` one agent); never for an agent you just woke or started, whose answer can take minutes: end your turn, and its answer wakes you |
| `agents_keep_running` | `POST /keep` | stay up while idle in the background (`on`, a `reason` the user sees, `minutes` up to 120), or end that ask |
| `schedule_add` | `POST /schedule/add` | a task for the agent itself later: `at` (local time), `in` minutes, `every` minutes (15 at least) or `daily` "HH:MM" on `days`; `chat` new or same |
| `schedule_list` | `POST /schedule/list` | the caller's schedules, with the phone's time and zone |
| `schedule_cancel` | `POST /schedule/cancel` | drop one the agent set itself (`id`); one the user set is refused |

Every message is labelled as from another AI agent, never the user. Where
an agent's kind allows, messages also reach it inside its turns (the
manifest's `inbox`, `../../agents/AGENTS.md` §4).

A scheduled task reaches its agent at its time with no app around: the
runner starts it with the task as its first prompt (the manifest's
`engine.prompt`), wakes it, or asks the user. A task the agent set reads
as its own reminder, never as a new instruction from the user
(`../../app/docs/modules/runner.md`, Schedules).

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
