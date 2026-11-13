package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.LaunchTargets
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Launch targets and agent alerts for JS (runner.ts).
internal fun ModuleDefinitionBuilder.notifyFunctions(context: () -> Context) {
  // The cold-start half of the phonecandoLaunchTarget event: { tab, agentId }
  // once, then null. Read-and-clear, so a stale target cannot move the user
  // on a later resume.
  Function("consumeLaunchTarget") {
    val ctx = runCatching(context).getOrNull() ?: return@Function null
    LaunchTargets.consume(ctx)?.toMap()
  }

  // The user has this agent's chat in front (useEngineTouch): its notice in
  // the agent's slot (an alert or the /app return notice) goes, and so do
  // its done and error chats in the service notification. A call of
  // its own rather than part of touchEngine, which also runs for engine
  // starts that show nothing (ensureEngine).
  Function("dismissAgentAlert") { agentId: String ->
    AgentAlerts.dismiss(context(), agentId)
    Engines.peek()?.chatsSeen(agentId)
  }

  // The chat on screen, or nulls when none is: a run that ends there is
  // seen, so the service notification never lists it as done. The web UI
  // names it by id (useOpenChat); a TUI only by the title it shows
  // (useOpenTuiChat). No supervisor yet means no engine and so no chat to
  // see; the chat's own engine start creates it before the chat page can
  // load.
  Function("setOpenChat") { agentId: String?, sessionId: String?, title: String? ->
    Engines.peek()?.setOpenChat(agentId, sessionId, title)
  }
}
