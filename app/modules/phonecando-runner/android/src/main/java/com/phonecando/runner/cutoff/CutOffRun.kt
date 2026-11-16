package com.phonecando.runner.cutoff

import com.phonecando.runner.engine.EngineMode
import org.json.JSONObject

/** Why runs outlived a stop: a self-update stopped every agent, or Android ended our service. */
enum class Held(val wire: String) {
  UPDATE("update"),
  SYSTEM("system"),
  ;

  companion object {
    fun of(wire: String?): Held? = values().firstOrNull { it.wire == wire }
  }
}

/**
 * A run an agent had going: a chat working (or waiting for your answer)
 * while its engine ran in [life]. It stays on disk until the run ends, the
 * agent is stopped, or a run cut off is brought back, dismissed or settled.
 */
data class CutOffRun(
  val agentId: String,
  /** A server's chat, or the chat ACP mode works in; null: a TUI's one chat (its resume args open it). */
  val chatId: String?,
  val title: String?,
  /** How it ran: its own app (a TUI or server) or ACP mode. */
  val mode: EngineMode,
  /** Epoch ms it was first seen going in this life. */
  val startedAt: Long,
  /** Epoch ms of the agent's last sign of work while it went (its engine's lastSignAt, read every CutOffRules.SEEN_EVERY_MS). */
  val seenAt: Long,
  /** The process that saw it (CutOffs.LIFE): another one's was cut off with it. */
  val life: String,
  /** Settings.Global.BOOT_COUNT then; null when unknown. */
  val boot: Int?,
  /** The scheduled run it belongs to, open when it began (schedule/ScheduleRuns). */
  val scheduleRun: Long? = null,
  /** Its engine died on its own at this epoch ms, with our process alive. */
  val diedAt: Long? = null,
  /** It outlived a stop that keeps runs (Held). */
  val held: Held? = null,
  /** Epoch ms this process last found it still going (the board still showed it); with [seenAt], how stale it was then. */
  val checkedAt: Long = seenAt,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("agentId", agentId)
    .put("chatId", chatId ?: JSONObject.NULL)
    .put("title", title ?: JSONObject.NULL)
    .put("mode", mode.wire)
    .put("startedAt", startedAt)
    .put("seenAt", seenAt)
    .put("life", life)
    .put("boot", boot ?: JSONObject.NULL)
    .put("scheduleRun", scheduleRun ?: JSONObject.NULL)
    .put("diedAt", diedAt ?: JSONObject.NULL)
    .put("held", held?.wire ?: JSONObject.NULL)
    .put("checkedAt", checkedAt)

  companion object {
    /** Null when [o] lacks what a run needs. */
    fun of(o: JSONObject): CutOffRun? {
      val agentId = o.optString("agentId", "").ifEmpty { return null }
      val life = o.optString("life", "").ifEmpty { return null }
      val mode = EngineMode.of(o.optString("mode", "")) ?: return null
      if (!o.has("startedAt") || !o.has("seenAt")) return null
      val seenAt = o.optLong("seenAt")
      return CutOffRun(
        agentId = agentId,
        chatId = text(o, "chatId"),
        title = text(o, "title"),
        mode = mode,
        startedAt = o.optLong("startedAt"),
        seenAt = seenAt,
        life = life,
        boot = if (o.isNull("boot")) null else o.optInt("boot"),
        scheduleRun = if (o.isNull("scheduleRun")) null else o.optLong("scheduleRun"),
        diedAt = if (o.isNull("diedAt")) null else o.optLong("diedAt"),
        held = Held.of(text(o, "held")),
        checkedAt = o.optLong("checkedAt", seenAt),
      )
    }

    private fun text(o: JSONObject, key: String): String? = if (o.isNull(key)) null else o.optString(key, "").ifEmpty { null }
  }
}
