package com.phonecando.runner.checks.now

import com.phonecando.runner.checks.now.CheckRun.Step

/**
 * One look at an agent while its check runs (CheckSampler reads it each
 * tick): its engine's state and mode as one word, whether the part's
 * engine is READY in the part's mode, a local model reading its prompt, a
 * question of it waiting for you, its ACP turn's items (how many, and the
 * last as a value), its engine's last sign of work (an activity event, its
 * TUI's output or what ACP mode sent), how many bridge calls and hook
 * reports it made, and whether a view shows its terminal. Pure.
 */
data class CheckSample(
  val engine: String,
  val ready: Boolean,
  val reading: CheckRun.Reading? = null,
  val asking: Boolean = false,
  val acpItems: Int = 0,
  val acpLast: Any? = null,
  val signAt: Long? = null,
  val heard: Long = 0,
  val viewer: Boolean = false,
) {
  /** What must change for the run to count as moving: all of it but the viewer, and the step. */
  data class Print(
    val engine: String,
    val read: Long?,
    val acpItems: Int,
    val acpLast: Any?,
    val signAt: Long?,
    val heard: Long,
    val step: Step,
  )

  fun print(step: Step) = Print(engine, reading?.read, acpItems, acpLast, signAt, heard, step)

  companion object {
    /**
     * The step of a running part: checking after its turn end, or once a
     * part with no task is ready (the chat it opened is judged); starting
     * until its start was asked and its engine is ready; then a question,
     * the prompt being read, or working.
     */
    fun step(launched: Boolean, turnEnded: Boolean, taskless: Boolean, readySeen: Boolean, sample: CheckSample): Step = when {
      turnEnded -> Step.CHECKING
      taskless && readySeen -> Step.CHECKING
      !launched || !sample.ready -> Step.STARTING
      sample.asking -> Step.ANSWER
      sample.reading != null -> Step.READING
      else -> Step.WORKING
    }
  }
}
