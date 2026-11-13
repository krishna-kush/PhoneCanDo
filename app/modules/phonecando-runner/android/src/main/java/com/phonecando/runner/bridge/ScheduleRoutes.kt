package com.phonecando.runner.bridge

import com.phonecando.runner.schedule.ChatMode
import com.phonecando.runner.schedule.Checked
import com.phonecando.runner.schedule.Schedule
import com.phonecando.runner.schedule.ScheduleBook
import com.phonecando.runner.schedule.ScheduleJson
import com.phonecando.runner.schedule.ScheduleRules
import com.phonecando.runner.schedule.SetBy
import com.phonecando.runner.schedule.Timing
import com.phonecando.runner.schedule.TimingText
import com.phonecando.runner.schedule.WireTime
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException

// The schedule_* tools' routes: the calling agent schedules a task for
// itself (never another agent: it messages others with agents_send), lists
// its schedules and cancels one it set. On every channel, neither gated nor
// a screen route: a task runs as the agent's own turn.
//   /schedule/add {text, at? | in? | every? | daily? (+ days?), chat?}
//     → {id, nextAt, nextAtText, timing, chat, zone}
//   /schedule/list {} → {now, zone, schedules:[{id, text, timing, nextAt, chat, on, by}]}
//   /schedule/cancel {id} → {id, cancelled: true}
// Exactly one of: at (ISO-8601; without an offset it is the phone's local
// time), in (minutes from now, 1..MAX_MINUTES), every (minutes,
// EVERY_MIN_MINUTES or more; the first run that far from now) or daily
// ("HH:MM", days ["mon".."sun"], none for every day). chat "new" | "same"
// (default: same for at and in, new for every and daily). Times answer as
// ISO-8601 with the phone's offset, nextAtText as the phone shows a time,
// timing as text (TimingText). Refusals: 400 bad_request (a missing or
// mistyped argument, a bad time), 403 not_allowed (the user switched off
// scheduling for this agent, a kind that cannot run tasks, cancelling a
// schedule the user set), 404 not_found (no such schedule of the caller's),
// 409 limit (ScheduleRules' caps). Pure apart from the book's store.
class ScheduleRoutes(
  private val book: ScheduleBook,
  /** The agent's "Can schedule itself" switch. */
  private val allowed: (agentId: String) -> Boolean,
  private val clock: () -> Long = System::currentTimeMillis,
  private val zone: () -> ZoneId = ZoneId::systemDefault,
  /** A time as the phone shows it. */
  private val timeText: (Long) -> String = { TimingText.iso(it, zone()) },
) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.SCHEDULE_ADD to ::add,
    Route.SCHEDULE_LIST to ::list,
    Route.SCHEDULE_CANCEL to ::cancel,
  )

  private fun add(call: BridgeCall): Reply {
    val id = call.agent.id
    if (!allowed(id)) return Reply.error(403, NOT_ALLOWED, "the user switched off scheduling for you")
    val text = when (val t = call.body.opt("text")) {
      is String -> t
      null, JSONObject.NULL -> return bad("text is required: the task you will be given at that time")
      else -> return wrongType("text")
    }
    val chat = when (val c = call.body.opt("chat")) {
      null, JSONObject.NULL -> null
      is String -> ChatMode.of(c.trim()) ?: return bad("chat is \"new\" or \"same\"")
      else -> return wrongType("chat")
    }
    val timing = when (val t = timing(call.body)) {
      is Checked.Ok -> t.value
      is Checked.Bad -> return bad(t.why)
    }
    return when (val r = book.add(id, ScheduleBook.Draft(text, timing, chat), SetBy.AGENT)) {
      is ScheduleBook.Result.Refused -> refused(r)
      is ScheduleBook.Result.Ok -> {
        val s = r.schedule
        val out = JSONObject()
          .put("id", s.id)
          .put("nextAt", s.nextAt?.let { TimingText.iso(it, zone()) } ?: JSONObject.NULL)
          .put("nextAtText", s.nextAt?.let(timeText) ?: JSONObject.NULL)
          .put("timing", TimingText.of(s.timing, zone()))
          .put("chat", s.chat.wire)
          .put("zone", zone().id)
        Reply.ok(out)
      }
    }
  }

  private fun list(call: BridgeCall): Reply {
    val z = zone()
    val items = book.of(call.agent.id).map { item(it, z) }
    return Reply.ok(
      JSONObject()
        .put("now", TimingText.iso(clock(), z))
        .put("zone", z.id)
        .put("schedules", JSONArray(items)),
    )
  }

  private fun cancel(call: BridgeCall): Reply {
    val id = when (val i = call.body.opt("id")) {
      is String -> i.trim().takeIf { it.isNotEmpty() } ?: return bad("id is required: one schedule_list shows")
      null, JSONObject.NULL -> return bad("id is required: one schedule_list shows")
      else -> return wrongType("id")
    }
    return when (val r = book.cancelByAgent(call.agent.id, id)) {
      is ScheduleBook.Result.Refused -> refused(r)
      is ScheduleBook.Result.Ok -> Reply.ok(JSONObject().put("id", id).put("cancelled", true))
    }
  }

  private fun item(s: Schedule, z: ZoneId): JSONObject = JSONObject()
    .put("id", s.id)
    .put("text", s.text)
    .put("timing", TimingText.of(s.timing, z))
    .put("nextAt", s.nextAt?.let { TimingText.iso(it, z) } ?: JSONObject.NULL)
    .put("chat", s.chat.wire)
    .put("on", s.on)
    .put("by", s.by.wire)

  // Exactly one of at, in, every, daily (days only with daily).
  private fun timing(body: JSONObject): Checked<Timing> {
    val given = WHEN.filter { body.has(it) && !body.isNull(it) }
    if (given.size != 1) return Checked.Bad("give exactly one of at, in, every or daily")
    val hasDays = body.has("days") && !body.isNull("days")
    if (hasDays && given[0] != "daily") return Checked.Bad("days go with daily only")
    val now = clock()
    return when (given[0]) {
      "at" -> at(body.opt("at"))
      "in" -> minutes(body.opt("in"), 1)?.let { Checked.Ok(Timing.Once(now + it * ScheduleRules.MINUTE_MS)) }
        ?: Checked.Bad("in is whole minutes from now, 1 to ${ScheduleRules.MAX_MINUTES}")
      "every" -> minutes(body.opt("every"), ScheduleRules.EVERY_MIN_MINUTES)?.let { Checked.Ok(Timing.Every(it, now)) }
        ?: Checked.Bad("every is whole minutes, ${ScheduleRules.EVERY_MIN_MINUTES} to ${ScheduleRules.MAX_MINUTES}")
      else -> daily(body.opt("daily"), if (hasDays) body.opt("days") else null)
    }
  }

  private fun at(value: Any?): Checked<Timing> {
    val text = (value as? String)?.trim()?.replaceFirst(' ', 'T') ?: return Checked.Bad("at is an ISO-8601 time")
    val ms = try {
      OffsetDateTime.parse(text).toInstant().toEpochMilli()
    } catch (_: DateTimeParseException) {
      try {
        LocalDateTime.parse(text).atZone(zone()).toInstant().toEpochMilli()
      } catch (_: DateTimeParseException) {
        return Checked.Bad("at is an ISO-8601 time, like 2026-11-14T09:00 (the phone's time) or with an offset")
      }
    }
    return Checked.Ok(Timing.Once(ms))
  }

  // Whole minutes in [min]..MAX_MINUTES; null otherwise.
  private fun minutes(value: Any?, min: Int): Int? {
    val d = (value as? Number)?.toDouble() ?: return null
    if (!d.isFinite() || d != Math.floor(d) || d < min || d > ScheduleRules.MAX_MINUTES) return null
    return d.toInt()
  }

  private fun daily(time: Any?, days: Any?): Checked<Timing> {
    val minute = (time as? String)?.let(WireTime::minuteOfDay) ?: return Checked.Bad("daily is a time of day as HH:MM")
    val list = when (days) {
      null -> null
      is JSONArray -> days
      else -> return Checked.Bad("days is a list of mon, tue, wed, thu, fri, sat, sun")
    }
    val set = ScheduleJson.days(list) ?: return Checked.Bad("days is a list of mon, tue, wed, thu, fri, sat, sun")
    return Checked.Ok(Timing.Daily(minute, set))
  }

  private fun refused(r: ScheduleBook.Result.Refused): Reply = when (r.code) {
    ScheduleBook.LIMIT -> Reply.error(409, ScheduleBook.LIMIT, r.reason)
    ScheduleBook.NOT_ALLOWED, ScheduleBook.UNSUPPORTED -> Reply.error(403, NOT_ALLOWED, r.reason)
    ScheduleBook.NOT_FOUND, ScheduleBook.AGENT_GONE -> Reply.error(404, "not_found", r.reason)
    else -> bad(r.reason)
  }

  private fun bad(why: String) = Reply.badRequest(BAD, why)

  private fun wrongType(key: String) = bad("$key has the wrong type")

  private companion object {
    const val BAD = "bad_request"
    const val NOT_ALLOWED = "not_allowed"
    val WHEN = listOf("at", "in", "every", "daily")
  }
}
