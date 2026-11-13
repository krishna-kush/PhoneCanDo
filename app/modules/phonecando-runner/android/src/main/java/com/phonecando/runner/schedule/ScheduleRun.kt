package com.phonecando.runner.schedule

import org.json.JSONObject

/**
 * One firing in the runs log: which schedule and agent (by the name it had
 * then), the task's first RUN_TEXT_MAX characters, who set it, when it was
 * due and when it fired, whether late, and what came of it. Pure.
 */
data class ScheduleRun(
  val seq: Long,
  val scheduleId: String,
  val agentId: String,
  val agentName: String,
  val text: String,
  val by: SetBy,
  val dueAt: Long,
  val firedAt: Long,
  val late: Boolean,
  val outcome: RunOutcome,
  val detail: String? = null,
) {
  /**
   * The log's line (also what JS gets):
   * {seq, scheduleId, agentId, agentName, text, by, dueAt, firedAt, late, outcome, detail?}.
   */
  fun toJson(): JSONObject = JSONObject()
    .put("seq", seq)
    .put("scheduleId", scheduleId)
    .put("agentId", agentId)
    .put("agentName", agentName)
    .put("text", text)
    .put("by", by.wire)
    .put("dueAt", dueAt)
    .put("firedAt", firedAt)
    .put("late", late)
    .put("outcome", outcome.wire)
    .also { o -> detail?.let { o.put("detail", it) } }

  companion object {
    /** A log line; null when it does not read as a run. */
    fun of(o: JSONObject): ScheduleRun? {
      val seq = o.optLong("seq", 0L).takeIf { it > 0 } ?: return null
      val scheduleId = o.optString("scheduleId").takeIf { it.isNotEmpty() } ?: return null
      return ScheduleRun(
        seq = seq,
        scheduleId = scheduleId,
        agentId = o.optString("agentId"),
        agentName = o.optString("agentName"),
        text = o.optString("text"),
        by = SetBy.of(o.optString("by")) ?: SetBy.USER,
        dueAt = o.optLong("dueAt", 0L),
        firedAt = o.optLong("firedAt", 0L),
        late = o.optBoolean("late", false),
        outcome = RunOutcome.of(o.optString("outcome")) ?: return null,
        detail = if (o.isNull("detail")) null else o.optString("detail").ifEmpty { null },
      )
    }
  }
}
