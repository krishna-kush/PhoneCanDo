package com.phonecando.runner.schedule

import org.json.JSONArray
import org.json.JSONObject

/**
 * A firing that waits for its agent (FireRules WAIT_IDLE): when it was due
 * and fired, whether late, [until] when it is skipped as busy (dueAt +
 * BUSY_WAIT), and [retryAt], when it was decided outside an alarm that it
 * starts the agent: the alarm at that time decides again and starts it.
 */
data class Waiting(
  val scheduleId: String,
  val dueAt: Long,
  val firedAt: Long,
  val late: Boolean,
  val until: Long,
  val retryAt: Long? = null,
)

// The schedules and their waiting firings in files/state/schedules.json:
//   {"schedules":[<ScheduleJson>...], "waiting":[{scheduleId, dueAt, firedAt, late, until, retryAt?}...]}
// written whole and atomically (StateFile). A schedule or waiting firing
// that does not read is left out; an unreadable file reads as empty. The
// waiting ones are kept so a firing outlives the process (its agent's
// engine went with it, so the next alarm decides again). Pure apart from
// the file.
class ScheduleStore(private val file: StateFile) {
  data class Saved(val schedules: List<Schedule>, val waiting: List<Waiting>)

  fun load(): Saved {
    val text = file.read() ?: return Saved(emptyList(), emptyList())
    val root = try {
      JSONObject(text)
    } catch (_: Exception) {
      return Saved(emptyList(), emptyList())
    }
    val schedules = objects(root.optJSONArray("schedules")).mapNotNull(ScheduleJson::read)
    val ids = schedules.map { it.id }.toSet()
    val waiting = objects(root.optJSONArray("waiting")).mapNotNull(::waiting).filter { it.scheduleId in ids }
    return Saved(schedules, waiting)
  }

  fun save(saved: Saved) {
    file.write(encode(saved))
  }

  companion object {
    fun encode(saved: Saved): String = JSONObject()
      .put("schedules", JSONArray(saved.schedules.map(ScheduleJson::write)))
      .put("waiting", JSONArray(saved.waiting.map(::waiting)))
      .toString()

    private fun waiting(w: Waiting): JSONObject = JSONObject()
      .put("scheduleId", w.scheduleId)
      .put("dueAt", w.dueAt)
      .put("firedAt", w.firedAt)
      .put("late", w.late)
      .put("until", w.until)
      .put("retryAt", w.retryAt ?: JSONObject.NULL)

    private fun waiting(o: JSONObject): Waiting? {
      val id = o.optString("scheduleId").takeIf { it.isNotEmpty() } ?: return null
      return Waiting(
        scheduleId = id,
        dueAt = o.optLong("dueAt", 0L),
        firedAt = o.optLong("firedAt", 0L),
        late = o.optBoolean("late", false),
        until = o.optLong("until", 0L),
        retryAt = if (o.isNull("retryAt")) null else o.optLong("retryAt", 0L).takeIf { it > 0 },
      )
    }

    private fun objects(list: JSONArray?): List<JSONObject> =
      if (list == null) emptyList() else (0 until list.length()).mapNotNull { list.optJSONObject(it) }
  }
}
