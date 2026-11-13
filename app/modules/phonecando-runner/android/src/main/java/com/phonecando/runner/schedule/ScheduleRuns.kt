package com.phonecando.runner.schedule

import org.json.JSONObject

// The runs log: files/state/schedule-runs.jsonl, one ScheduleRun per line,
// oldest first, the newest RUNS_KEPT kept. Held in memory and written whole
// (StateFile) on every change; a run's outcome can change after it was
// logged (a start that failed). seq goes on from the highest in the file.
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

  /** The run [seq] came to [outcome] after all; null when it is no longer kept. */
  @Synchronized
  fun update(seq: Long, outcome: RunOutcome, detail: String?): ScheduleRun? {
    val i = runs.indexOfFirst { it.seq == seq }
    if (i < 0) return null
    runs[i] = runs[i].copy(outcome = outcome, detail = detail)
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
}
