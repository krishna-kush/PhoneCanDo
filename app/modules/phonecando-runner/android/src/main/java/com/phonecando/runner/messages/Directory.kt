package com.phonecando.runner.messages

import com.phonecando.runner.agents.AgentRecord
import org.json.JSONArray
import org.json.JSONObject

// What agents_list answers, from [caller]'s side:
//   {you:{name, id, kind, machine:"yours"}, scope,
//    screen:{holder, reserved, waiting:[name], yourPlace},
//    agents:[{name, id, kind, machine:"yours"|"other", machineMates:[name],
//             state:"working"|"waiting"|"idle"|"stopped", chat,
//             status:{text, mood:"working"|"thinking"|"waiting"}|null,
//             messages:"wakes"|"delivered"|"inbox"|"none", wakeable, canWake}]}
// scope "machine" (the default) lists the other agents on the caller's
// machine, "phone" every other agent. kind is the kind's label; machineMates
// the other agents on that agent's machine; chat its working chat's title,
// else its latest (null when none is known); status what it says it is
// doing now (agents_status; null when it said nothing this run); messages how far messages
// reach it (kit MessagingLevel: none means it can't read them, so a send
// to it is refused); canWake whether a direct message with wake: true
// would start its run now if it is idle (its switch, its kind and, for a
// kind that wakes through a waiting hook, that hook alive; for a kind with
// an ACP mode, idle in it or free to switch to it; its engine running, or
// stopped and free to start for it, start/StartRules; its wakes left this
// hour).
// screen: who holds the screen (or has it reserved), who waits, and the
// caller's place in line (1-based; null when not in it). Pure.
object Directory {
  const val MACHINE = "machine"
  const val PHONE = "phone"

  fun scope(raw: String?): String = if (raw?.trim()?.lowercase() == PHONE) PHONE else MACHINE

  fun list(caller: AgentRecord, scope: String, view: AgentsView, wakesLeft: (String) -> Int): JSONObject {
    val all = view.all()
    val others = all.filter { it.id != caller.id && (scope == PHONE || it.imageId == caller.imageId) }
    val agents = JSONArray()
    for (a in others) {
      val presence = view.presence(a.id)
      val mates = all.filter { it.imageId == a.imageId && it.id != a.id }.map { it.name }
      val ready = if (presence.state == AgentState.STOPPED) view.startRefusal(a) == null else presence.running && view.wakeReady(a)
      val canWake = a.wakeable && view.kindCanWake(a.kind) && ready && wakesLeft(a.id) > 0
      agents.put(
        JSONObject()
          .put("name", a.name)
          .put("id", a.id)
          .put("kind", view.kindLabel(a.kind))
          .put("machine", if (a.imageId == caller.imageId) "yours" else "other")
          .put("machineMates", JSONArray(mates))
          .put("state", presence.state.wire)
          .put("chat", presence.chat ?: JSONObject.NULL)
          .put("status", view.status(a.id)?.let { (text, mood) -> JSONObject().put("text", text).put("mood", mood) } ?: JSONObject.NULL)
          .put("messages", view.kindLevel(a.kind).wire)
          .put("wakeable", a.wakeable)
          .put("canWake", canWake),
      )
    }
    return JSONObject()
      .put(
        "you",
        JSONObject().put("name", caller.name).put("id", caller.id).put("kind", view.kindLabel(caller.kind)).put("machine", "yours")
          .put("messages", view.kindLevel(caller.kind).wire),
      )
      .put("scope", scope)
      .put("screen", screen(caller, view.screen(), all))
      .put("agents", agents)
  }

  private fun screen(caller: AgentRecord, line: ScreenLine, all: List<AgentRecord>): JSONObject {
    fun name(id: String) = all.firstOrNull { it.id == id }?.name ?: id
    val place = line.waiting.indexOf(caller.id).takeIf { it >= 0 }?.plus(1)
    return JSONObject()
      .put("holder", line.holder?.let(::name) ?: JSONObject.NULL)
      .put("reserved", line.reserved)
      .put("waiting", JSONArray(line.waiting.map(::name)))
      .put("yourPlace", place ?: JSONObject.NULL)
  }
}
