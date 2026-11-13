package com.phonecando.runner.schedule

import org.json.JSONArray
import org.json.JSONObject

// Schedules and runs as the app reads them (NativeSchedule, NativeScheduleRun
// in the module's TS types): their wire JSON (ScheduleJson, ScheduleRun) as
// maps, numbers as doubles the way the bridge to JS passes them, JSON null
// as null; and the results of a change, {ok: true, schedule} or
// {ok: false, reason, code}: reason is the code the app words itself
// (limit, unsupported, not_found, agent_gone), else a plain sentence it
// shows as it is. Pure.
object ScheduleJs {
  fun of(s: Schedule): Map<String, Any?> = map(ScheduleJson.write(s))

  fun of(r: ScheduleRun): Map<String, Any?> = map(r.toJson())

  fun result(r: ScheduleBook.Result): Map<String, Any?> = when (r) {
    is ScheduleBook.Result.Ok -> mapOf("ok" to true, "schedule" to of(r.schedule))
    is ScheduleBook.Result.Refused -> refused(r.code, r.reason)
  }

  fun refused(code: String, reason: String): Map<String, Any?> =
    mapOf("ok" to false, "reason" to if (code in WORDED) code else sentence(reason), "code" to code)

  /** "The task text is empty." for "the task text is empty". */
  fun sentence(reason: String): String {
    val text = reason.trim().replaceFirstChar { it.uppercaseChar() }
    return if (text.endsWith('.') || text.endsWith('?') || text.endsWith('!')) text else "$text."
  }

  private val WORDED = setOf(ScheduleBook.LIMIT, ScheduleBook.UNSUPPORTED, ScheduleBook.NOT_FOUND, ScheduleBook.AGENT_GONE)

  fun map(o: JSONObject): Map<String, Any?> = buildMap {
    for (key in o.keys()) put(key, value(o.opt(key)))
  }

  private fun value(v: Any?): Any? = when (v) {
    null, JSONObject.NULL -> null
    is JSONObject -> map(v)
    is JSONArray -> (0 until v.length()).map { value(v.opt(it)) }
    is Boolean, is String -> v
    is Number -> v.toDouble()
    else -> v.toString()
  }
}
