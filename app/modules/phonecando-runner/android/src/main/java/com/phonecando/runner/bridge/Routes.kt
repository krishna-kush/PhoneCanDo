package com.phonecando.runner.bridge

// Every bridge route and what guards it, in the order the router checks:
//   fullOnly: exists only in full builds; lite/play answer 404 not_found.
//   gated:    needs the phone-control switch in full builds (403 automation_off).
//   pce:      needs the accessibility service connected (503 automation_unavailable).
//   screen:   changes what is on screen, or replaces the PCE's one current
//             snapshot, so in full builds it takes the screen lease
//             (ScreenLease; 409 control_busy with a place in line while
//             another agent has it, 409 screen_refused for a turn another
//             agent's message started). Lite/play have no driver whose flow
//             it could break.
// Screen routes: /pce/observe, /pce/act and /pce/pack (a pack run drives the
// screen and every pack call shares the PCE lane), /open and /share (they
// start an activity over whatever is showing) and /app (brings PhoneCanDo
// forward; the holder's /app also ends its lease, see BridgeRouter). Not
// screen routes: /ping, /battery, /notify, /clipboard, /pce/describe, and the
// prompts /unlock and /accessibility: they only matter while the gate is off
// or the service is down, when nobody can drive the screen anyway, and the
// app queues their dialogs. In ask mode others can drive while one agent is
// locked, so a locked agent's /unlock waits in line while another agent has
// the screen, and its dialog stops its time on it (BridgeRouter,
// ScreenLease). The /agents/* routes (messages between agents,
// AgentRoutes) exist on every channel and are neither gated nor screen
// routes: talking to another agent is not phone control. Nor is /keep
// (an agent asking to stay up while idle, KeepRoutes), on every channel
// too: it changes nothing on the phone. Nor are /schedule/* (an agent's
// tasks for itself, ScheduleRoutes), on every channel: a task runs as the
// agent's own turn. /mcp is not a
// route: BridgeEntry hands it to the MCP endpoint (mcp/), whose tools call
// these routes through the router.
// Pure.
enum class Route(
  val method: String,
  val path: String,
  val fullOnly: Boolean = false,
  val gated: Boolean = false,
  val pce: Boolean = false,
  val screen: Boolean = false,
) {
  PING("GET", "/ping"),
  BATTERY("GET", "/battery"),
  NOTIFY("POST", "/notify", gated = true),
  CLIPBOARD("POST", "/clipboard", gated = true),
  SHARE("POST", "/share", gated = true, screen = true),
  OPEN("POST", "/open", gated = true, screen = true),
  APP("POST", "/app", screen = true),
  UNLOCK("POST", "/unlock", fullOnly = true),
  ACCESSIBILITY("POST", "/accessibility", fullOnly = true),
  PCE_DESCRIBE("GET", "/pce/describe", fullOnly = true, gated = true, pce = true),
  PCE_OBSERVE("POST", "/pce/observe", fullOnly = true, gated = true, pce = true, screen = true),
  PCE_ACT("POST", "/pce/act", fullOnly = true, gated = true, pce = true, screen = true),
  PCE_PACK("POST", "/pce/pack", fullOnly = true, gated = true, pce = true, screen = true),
  AGENTS_LIST("POST", "/agents/list"),
  AGENTS_SEND("POST", "/agents/send"),
  AGENTS_INBOX("POST", "/agents/inbox"),
  AGENTS_WAIT("POST", "/agents/wait"),
  KEEP("POST", "/keep"),
  SCHEDULE_ADD("POST", "/schedule/add"),
  SCHEDULE_LIST("POST", "/schedule/list"),
  SCHEDULE_CANCEL("POST", "/schedule/cancel"),
  ;

  companion object {
    fun find(method: String, path: String): Route? =
      entries.firstOrNull { it.method == method && it.path == path }

    // Telemetry key per route: the path without its leading slash, `/` as
    // `_` (tce's tool.<name> allows [a-z0-9_] only). Keys are route names,
    // not mobile_* tool names: that mapping lives in the agent plugins, and
    // many tools share /pce/act. A fixed table, so an unknown path never
    // becomes a key; looked up by path whatever the method, as a wrong
    // method answers 404, which is not counted.
    fun telemetryKey(path: String): String? =
      entries.firstOrNull { it.path == path }?.path?.removePrefix("/")?.replace('/', '_')
  }
}
