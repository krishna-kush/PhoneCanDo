package com.phonecando.linux.guest

import com.phonecando.linux.jobs.ScriptActivity
import com.phonecando.linux.jobs.ScriptDetail
import com.phonecando.linux.jobs.ScriptRetry

/**
 * What a guest script's output turns into: each line redacted for the log,
 * the phase its `@phase <name>` lines name, the retry its `@retry` lines
 * announce (until the next phase), and its last [tailLines] other lines for
 * the progress events; marker lines stay out of the tail (ScriptMarks). A
 * retry starts the tail afresh: the failed try's errors stay in the log, and
 * the screen shows the new try ("trying again" already says why).
 * Pure; synchronized, since a pump thread feeds it while the job reads it.
 */
internal class ScriptOutput(private val tailLines: Int = TAIL_LINES) {
  private val tail = ArrayDeque<String>()
  private var phase: String? = null
  private var retry: ScriptRetry? = null

  /** How many phases the script began so far. */
  @get:Synchronized
  var phases = 0L
    private set

  /** Takes one line of output; returns it redacted, as the log keeps it. */
  @Synchronized
  fun line(raw: String): String {
    val text = LogRedactor.redact(raw)
    val name = ScriptMarks.phaseOf(raw)
    val again = if (name == null) ScriptMarks.retryOf(raw) else null
    when {
      name != null -> {
        phase = name
        phases++
        retry = null
      }
      again != null -> {
        retry = again
        tail.clear()
      }
      else -> {
        tail.addLast(text)
        if (tail.size > tailLines) tail.removeFirst()
      }
    }
    return text
  }

  /** The state for a progress event; [exitCode] once the script ended by itself. */
  @Synchronized
  fun detail(exitCode: Int?, activity: ScriptActivity? = null): ScriptDetail =
    ScriptDetail(phase, tail.toList(), exitCode, retry, activity)

  companion object {
    const val TAIL_LINES = 20
  }
}
