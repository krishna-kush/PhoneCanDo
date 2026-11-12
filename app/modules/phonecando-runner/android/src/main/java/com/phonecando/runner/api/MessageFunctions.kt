package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.messages.MessageEvents
import com.phonecando.runner.messages.MessageJs
import com.phonecando.runner.messages.Messages
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Messages between agents for JS (messages/; the TS types are NativeMessage
// and friends): the log newest first, the unread counts, the screen line
// and each agent's "Other agents can wake it". Every change is the
// phonecandoMessages event ({unread}), through [emit] (MessageEvents).
internal fun ModuleDefinitionBuilder.messageFunctions(context: () -> Context, emit: (Map<String, Any?>) -> Unit) {
  MessageEvents.sink = emit

  // NativeMessage[], newest first; at most the log's cap.
  Function("messageLog") { limit: Int ->
    Messages.get(context()).mailbox.recent(limit).map(MessageJs::of)
  }

  // { agentId: unread }, only agents with some.
  Function("unreadCounts") {
    Messages.get(context()).unreadCounts().mapValues { it.value.toDouble() }
  }

  // { holder: {agentId, name} | null, reserved, waiting: [{agentId, name}] }:
  // empty while no bridge is open (no agent with phone tools runs).
  Function("screenQueue") {
    val line = Bridge.screenLine()
    mapOf(
      "holder" to line?.holder?.let { mapOf("agentId" to it.agentId, "name" to it.name) },
      "reserved" to (line?.reserved == true),
      "waiting" to line?.waiting.orEmpty().map { mapOf("agentId" to it.agentId, "name" to it.name) },
    )
  }

  // The agent as kept (NativeAgent). Its pending messages are handed over
  // again, so a wake that was waiting goes or comes with the switch.
  Function("setAgentWakeable") { agentId: String, wakeable: Boolean ->
    val ctx = context()
    val record = AgentStores.get(ctx).setWakeable(agentId, wakeable)
    Messages.get(ctx).mailbox.refresh(agentId)
    MessageEvents.changed(Messages.get(ctx).unreadCounts())
    agentToJs(ctx, record)
  }
}
