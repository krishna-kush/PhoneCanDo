package com.phonecando.runner.schedule

import org.json.JSONObject

// The runs log: files/state/schedule-runs.jsonl, one ScheduleRun per line,
// oldest first, the newest RUNS_KEPT kept. Held in memory and written whole
// (StateFile) on every change; a run's outcome can change after it was
// logged (a start that failed). seq goes on from the highest in the file.
// A run left open (ScheduleRun.open) by an earlier process was cut off with
// it: closeOpen fails it. One brought back (cutoff/) stays failed, with
// when in its detail (addNote).
// A deleted agent's runs stay, under the name it had. Thread-safe; pure
// apart from the file.
class ScheduleRuns(
  private val file: StateFile,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) {
  private val runs = ArrayList<ScheduleRun>()
  private var nextSeq = 1L

  init {
    file.read()?.lineSequence()?.forEach { line ->
      if (line.isBlank()) return@forEach
      val run = try {
        ScheduleRun.of(JSONObject(line))
      } catch (_: Exception) {
        null
      }
      run?.let(runs::add)
    }
    runs.sortBy { it.seq }
    nextSeq = (runs.maxOfOrNull { it.seq } ?: 0L) + 1
    trim()
  }

  /** A new run with the next seq ([build] gets it). */
  @Synchronized
  fun add(build: (seq: Long) -> ScheduleRun): ScheduleRun {
    val run = build(nextSeq++)
    runs += run
    trim()
    save()
    return run
  }

  /** The run [seq] came to [outcome] after all (no longer open unless [open]); null when it is no longer kept. */
  @Synchronized
  fun update(seq: Long, outcome: RunOutcome, detail: String?, open: Boolean = false): ScheduleRun? {
    val i = runs.indexOfFirst { it.seq == seq }
    if (i < 0) return null
    runs[i] = runs[i].copy(outcome = outcome, detail = detail, open = open)
    save()
    return runs[i]
  }

  /**
   * The chat the run [seq] ran in, and the agent's reply there; null leaves
   * that one as it was. The run; null when it is no longer kept. The caller
   * tells the app (ScheduleEvents.changed).
   */
  @Synchronized
  fun answer(seq: Long, chatId: String?, reply: String?): ScheduleRun? {
    val i = runs.indexOfFirst { it.seq == seq }
    if (i < 0) return null
    runs[i] = runs[i].copy(chatId = chatId ?: runs[i].chatId, reply = reply ?: runs[i].reply)
    save()
    return runs[i]
  }

  /** The start or turn the run [seq] began is over: its outcome stands. */
  @Synchronized
  fun settle(seq: Long) {
    val i = runs.indexOfFirst { it.seq == seq }
    if (i < 0 || !runs[i].open) return
    runs[i] = runs[i].copy(open = false)
    save()
  }

  /**
   * Every run still open, failed with [detail]: on a process's first look
   * they were an earlier process's, cut off with it. The runs closed, each
   * with whether it is still its schedule's newest.
   */
  @Synchronized
  fun closeOpen(detail: String): List<Pair<ScheduleRun, Boolean>> {
    val closed = runs.indices.filter { runs[it].open }.map { i ->
      runs[i] = runs[i].copy(outcome = RunOutcome.FAILED, detail = detail, open = false)
      runs[i]
    }
    if (closed.isEmpty()) return emptyList()
    save()
    return closed.map { run -> run to (runs.last { it.scheduleId == run.scheduleId }.seq == run.seq) }
  }

  /** The newest run of [agentId] still open; null when none is. */
  @Synchronized
  fun openOf(agentId: String): Long? = runs.lastOrNull { it.agentId == agentId && it.open }?.seq

  /**
   * The newest run of [agentId] that set it working (started, woke or
   * restarted it) and fired at [since] or later; null when none did. A
   * terminal start settles at ready, before its task's run is seen.
   */
  @Synchronized
  fun setWorkingSince(agentId: String, since: Long): Long? =
    runs.lastOrNull { it.agentId == agentId && it.firedAt >= since && it.outcome in WORKING }?.seq

  /** [note] after the run [seq]'s detail, its outcome as it was; null when it is no longer kept. */
  @Synchronized
  fun addNote(seq: Long, note: String): ScheduleRun? {
    val i = runs.indexOfFirst { it.seq == seq }
    if (i < 0) return null
    val detail = runs[i].detail?.takeIf { it.isNotBlank() }
    runs[i] = runs[i].copy(detail = if (detail == null) note else "$detail; $note")
    save()
    return runs[i]
  }

  /** The newest [limit], newest first. */
  @Synchronized
  fun newest(limit: Int): List<ScheduleRun> = runs.takeLast(limit.coerceIn(0, ScheduleRules.RUNS_KEPT)).reversed()

  private fun trim() {
    while (runs.size > ScheduleRules.RUNS_KEPT) runs.removeAt(0)
  }

  private fun save() {
    try {
      file.write(runs.joinToString("") { it.toJson().toString() + "\n" })
    } catch (e: Exception) {
      onError("schedule runs not saved", e)
    }
  }

  private companion object {
    val WORKING = setOf(RunOutcome.STARTED, RunOutcome.WOKE, RunOutcome.RESTARTED)
  }
}
