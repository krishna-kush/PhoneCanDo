package com.phonecando.runner.checks.now

import com.phonecando.runner.engine.EngineMode

/**
 * An agent's last Check now as the app reads it (NativeCheckRun): its
 * state since [startedAt], when anything last moved ([movedAt]), the part
 * it is on ([part] of [parts], in [partMode]), while running its step
 * (and the prompt reading while that is the step), why it didn't finish,
 * and each capability it tests ([rows], part by part). Times are epoch ms.
 * Pure.
 */
data class CheckRun(
  val state: State,
  val startedAt: Long,
  val movedAt: Long,
  val part: Int,
  val parts: Int,
  val partMode: EngineMode,
  val step: Step? = null,
  val reading: Reading? = null,
  val detail: String? = null,
  val rows: List<Row> = emptyList(),
) {
  enum class State(val wire: String) {
    RUNNING("running"),
    DONE("done"),
    STUCK("stuck"),
    CANCELLED("cancelled"),
    FAILED("failed"),
  }

  /** What a running part does now; [words] name it in a stuck run's detail. */
  enum class Step(val wire: String, val words: String) {
    /** The part's engine is not ready yet. */
    STARTING("starting", "starting"),

    /** A local model reads this agent's prompt. */
    READING("reading", "reading the task"),

    /** A question of this agent waits for you. */
    ANSWER("answer", "waiting for your answer"),

    /** Ready, before its turn end, not reading, no question. */
    WORKING("working", "working on the task"),

    /** In its own app, working, and nothing moved for STALL_MS: it may be asking you something there. */
    WAITING("waiting", "waiting for you in its own app"),

    /** After its turn end (or while the chat it opened is judged). */
    CHECKING("checking", "checking what it did"),
  }

  /** Prompt tokens a local model has read of [total] (null: it doesn't say). */
  data class Reading(val read: Long, val total: Long?) {
    /** Whole percent read; null without a total. */
    val percent: Int? get() = total?.takeIf { it > 0 }?.let { (read * 100 / it).coerceIn(0, 100).toInt() }
  }

  /** Where one capability's test stands: [why] for unknown and skipped; [failed]: its verdict was Not working. */
  data class Row(val id: String, val part: Int, val status: RowStatus, val why: String? = null, val failed: Boolean = false) {
    fun toMap(): Map<String, Any?> = buildMap {
      put("id", id)
      put("part", part)
      put("status", status.wire)
      why?.let { put("why", it) }
    }
  }

  enum class RowStatus(val wire: String) {
    /** Its part hasn't started yet. */
    QUEUED("queued"),

    /** Its part runs; no verdict yet. */
    TESTING("testing"),

    /** A verdict came during its part (Checked or Not working). */
    ANSWERED("answered"),

    /** Its part ended, or the run did, with no verdict. */
    UNKNOWN("unknown"),

    /** No part of this check can test it. */
    SKIPPED("skipped"),
  }

  /** The rows answered Checked, answered Not working, and unknown. */
  data class Tally(val checked: Int, val notWorking: Int, val unknown: Int)

  val running: Boolean get() = state == State.RUNNING

  fun tally(): Tally = Tally(
    checked = rows.count { it.status == RowStatus.ANSWERED && !it.failed },
    notWorking = rows.count { it.status == RowStatus.ANSWERED && it.failed },
    unknown = rows.count { it.status == RowStatus.UNKNOWN },
  )

  fun toMap(): Map<String, Any?> = buildMap {
    put("state", state.wire)
    put("startedAt", startedAt)
    put("movedAt", movedAt)
    put("part", part)
    put("parts", parts)
    put("partMode", partMode.wire)
    if (running) step?.let { put("step", it.wire) }
    if (running && step == Step.READING) {
      reading?.let { r ->
        put("reading", buildMap<String, Any?> { put("read", r.read); r.total?.let { put("total", it) } })
      }
    }
    detail?.let { put("detail", it) }
    put("rows", rows.map { it.toMap() })
  }
}
