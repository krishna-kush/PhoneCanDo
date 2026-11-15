package com.phonecando.runner.engine.acp

import org.json.JSONArray
import org.json.JSONObject
import java.time.OffsetDateTime

// What we read out of an ACP agent's answers and questions: a new chat's
// id, the newest chat in its list (by updatedAt; one without a time loses
// to one with, and with no times at all the first listed wins), the
// config options (engine.acp.options) worth setting on a chat it opened
// (only an option it offers, with a value it offers, not already set), a
// turn's stop reason, a permission question, and why a step failed in
// words for the agent's status. Pure.
internal object AcpAnswers {
  fun sessionId(answer: JSONObject): String? = answer.textOf("sessionId")

  fun stopReason(answer: JSONObject): String? = answer.textOf("stopReason")

  fun newestChat(listed: JSONObject): String? {
    val sessions = listed.optJSONArray("sessions") ?: return null
    var best: String? = null
    var bestAt: Long? = null
    for (i in 0 until sessions.length()) {
      val s = sessions.optJSONObject(i) ?: continue
      val id = s.textOf("sessionId") ?: continue
      val at = timeOf(s)
      if (best == null || (at != null && (bestAt == null || at > bestAt))) {
        best = id
        bestAt = at
      }
    }
    return best
  }

  /** [wanted] (configId to value) that [opened] (a session/new, load or resume answer) offers and has not set, in [wanted]'s order. */
  fun optionsToSet(opened: JSONObject, wanted: Map<String, String>): List<Pair<String, String>> {
    val offered = opened.optJSONArray("configOptions") ?: return emptyList()
    val byId = (0 until offered.length()).mapNotNull { offered.optJSONObject(it) }.associateBy { it.textOf("id") }
    return wanted.entries.mapNotNull { (id, value) ->
      val option = byId[id] ?: return@mapNotNull null
      if (option.textOf("currentValue") == value || value !in values(option.optJSONArray("options"))) null else id to value
    }
  }

  /** The question in a session/request_permission's [params], under our [requestId]. */
  fun permissionAsk(requestId: String, params: JSONObject): AcpPermissionAsk {
    val tool = params.optJSONObject("toolCall")
    val options = params.optJSONArray("options")
    return AcpPermissionAsk(
      requestId = requestId,
      title = tool?.textOf("title") ?: "a tool",
      toolKind = tool?.textOf("kind"),
      options = (0 until (options?.length() ?: 0)).mapNotNull { i ->
        val o = options?.optJSONObject(i) ?: return@mapNotNull null
        val id = o.textOf("optionId") ?: return@mapNotNull null
        AcpOption(id, o.textOf("name") ?: id, o.textOf("kind") ?: "")
      },
    )
  }

  /** Why opening the agent failed, for its status: sign-in first in plain words, else the step and the agent's message. */
  fun failure(e: Exception): String {
    val acp = e as? AcpException ?: return "its ACP mode failed: ${e.message ?: e.javaClass.simpleName}"
    if (acp.error.code == AcpWire.AUTH_REQUIRED || acp.error.message.contains("authenticat", ignoreCase = true)) {
      return "needs sign-in: open it and sign in, then it can work in the background"
    }
    return "its ACP mode failed at ${acp.method}: ${acp.error.message}"
  }

  // A select option's values, its groups' too.
  private fun values(options: JSONArray?): Set<String> {
    options ?: return emptySet()
    val out = HashSet<String>()
    for (i in 0 until options.length()) {
      val o = options.optJSONObject(i) ?: continue
      val group = o.optJSONArray("options")
      if (group != null) {
        out += values(group)
      } else {
        (o.textOf("value") ?: o.textOf("id"))?.let(out::add)
      }
    }
    return out
  }

  // Epoch ms of a listed chat's updatedAt (ISO 8601, or a number); null without one.
  private fun timeOf(session: JSONObject): Long? {
    (session.opt("updatedAt") as? Number)?.let { return it.toLong() }
    val text = session.textOf("updatedAt") ?: return null
    return try {
      OffsetDateTime.parse(text).toInstant().toEpochMilli()
    } catch (_: Exception) {
      null
    }
  }
}
