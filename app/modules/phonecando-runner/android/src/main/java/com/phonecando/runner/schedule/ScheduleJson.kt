package com.phonecando.runner.schedule

import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek

// A schedule on the wire (the store file, JS, the tools), and back:
//   {id, agentId, text,
//    timing: {type:"once", at} | {type:"every", minutes, anchor}
//            | {type:"daily", time:"HH:MM", days:["mon",..,"sun"]},
//    chat:"new"|"same", on, by:"user"|"agent", createdAt, nextAt|null,
//    lastRun:{at, outcome, detail?}|null}
// Times are epoch ms. A schedule that does not read whole is null (the
// store leaves it out). Pure (org.json ships with Android; the tests add it).
object ScheduleJson {
  fun write(s: Schedule): JSONObject = JSONObject()
    .put("id", s.id)
    .put("agentId", s.agentId)
    .put("text", s.text)
    .put("timing", timing(s.timing))
    .put("chat", s.chat.wire)
    .put("on", s.on)
    .put("by", s.by.wire)
    .put("createdAt", s.createdAt)
    .put("nextAt", s.nextAt ?: JSONObject.NULL)
    .put("lastRun", s.lastRun?.let(::lastRun) ?: JSONObject.NULL)

  fun read(o: JSONObject): Schedule? {
    val id = o.optString("id").takeIf { it.isNotEmpty() } ?: return null
    val agentId = o.optString("agentId").takeIf { it.isNotEmpty() } ?: return null
    val timing = (timing(o.optJSONObject("timing") ?: return null, anchor = null) as? Checked.Ok)?.value ?: return null
    return Schedule(
      id = id,
      agentId = agentId,
      text = o.optString("text"),
      timing = timing,
      chat = ChatMode.of(o.optString("chat")) ?: ChatMode.defaultFor(timing),
      on = o.optBoolean("on", true),
      by = SetBy.of(o.optString("by")) ?: SetBy.USER,
      createdAt = o.optLong("createdAt", 0L),
      nextAt = if (o.isNull("nextAt")) null else o.optLong("nextAt", 0L).takeIf { it > 0 },
      lastRun = o.optJSONObject("lastRun")?.let(::lastRun),
    )
  }

  fun timing(t: Timing): JSONObject = when (t) {
    is Timing.Once -> JSONObject().put("type", ONCE).put("at", t.at)
    is Timing.Every -> JSONObject().put("type", EVERY).put("minutes", t.minutes).put("anchor", t.anchor)
    is Timing.Daily -> JSONObject().put("type", DAILY).put("time", WireTime.clock(t.minuteOfDay))
      .put("days", JSONArray(t.days.sorted().map(WireTime::day)))
  }

  /**
   * A timing from the wire; [anchor] stands in for an every's missing
   * anchor (the app sets one from now), and with none it must be there.
   */
  fun timing(o: JSONObject, anchor: Long?): Checked<Timing> = when (o.optString("type")) {
    ONCE -> number(o, "at")?.let { Checked.Ok(Timing.Once(it)) } ?: Checked.Bad("a once needs at (epoch ms)")
    EVERY -> {
      val minutes = number(o, "minutes")?.takeIf { it in 1L..Int.MAX_VALUE.toLong() }?.toInt()
      val from = number(o, "anchor") ?: anchor
      if (minutes == null || from == null) Checked.Bad("every needs minutes") else Checked.Ok(Timing.Every(minutes, from))
    }
    DAILY -> {
      val minute = WireTime.minuteOfDay(o.optString("time"))
      val days = days(o.optJSONArray("days"))
      when {
        minute == null -> Checked.Bad("daily needs time as HH:MM")
        days == null -> Checked.Bad("days are mon, tue, wed, thu, fri, sat or sun")
        else -> Checked.Ok(Timing.Daily(minute, days))
      }
    }
    else -> Checked.Bad("timing type is once, every or daily")
  }

  /** "mon".."sun" as days; empty for none or no list; null when one is not a day. */
  fun days(list: JSONArray?): Set<DayOfWeek>? {
    if (list == null) return emptySet()
    val out = LinkedHashSet<DayOfWeek>()
    for (i in 0 until list.length()) out += WireTime.dayOf(list.optString(i)) ?: return null
    return out
  }

  private fun lastRun(r: LastRun): JSONObject = JSONObject()
    .put("at", r.at)
    .put("outcome", r.outcome.wire)
    .also { o -> r.detail?.let { o.put("detail", it) } }

  private fun lastRun(o: JSONObject): LastRun? {
    val outcome = RunOutcome.of(o.optString("outcome")) ?: return null
    return LastRun(o.optLong("at", 0L), outcome, if (o.isNull("detail")) null else o.optString("detail").ifEmpty { null })
  }

  // A whole number (JS sends doubles); null when absent or not one.
  private fun number(o: JSONObject, key: String): Long? {
    val v = o.opt(key) as? Number ?: return null
    val d = v.toDouble()
    return if (d.isFinite() && d == Math.floor(d)) d.toLong() else null
  }

  const val ONCE = "once"
  const val EVERY = "every"
  const val DAILY = "daily"
}
