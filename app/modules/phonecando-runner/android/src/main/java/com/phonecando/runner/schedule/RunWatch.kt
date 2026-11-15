package com.phonecando.runner.schedule

import com.phonecando.runner.checks.rules.CheckRules
import com.phonecando.runner.messages.MessageRules

// Runs Firing keeps an eye on after it logged them:
// - a terminal start with the task as its first prompt, for TASK_WINDOW_MS
//   from its READY: its kind's task check failing then (it quit right after
//   starting with the task) fails the run. One per agent; a new start's
//   replaces it.
// - a hook or reader wake: its scheduled notice still unread
//   WAKE_RECEIPT_MS after the wake (nothing picked it up) fails the run.
// Thread-safe; pure: the clock is injected, the unread test is the caller's.
internal class RunWatch(private val clock: () -> Long) {
  /** A logged run: its schedule and seq. */
  data class Run(val scheduleId: String, val seq: Long)

  private class Window(val run: Run, val readyAt: Long)

  private class Receipt(val agentId: String, val messageId: Long, val run: Run, val at: Long)

  private val windows = HashMap<String, Window>()
  private val receipts = ArrayList<Receipt>()

  /** [agentId]'s start for [run] is ready: its window opens. */
  @Synchronized
  fun ready(agentId: String, run: Run) {
    windows[agentId] = Window(run, clock())
  }

  /** [agentId]'s task check failed: the run whose window is open, once; null when none is. */
  @Synchronized
  fun taskFailed(agentId: String): Run? {
    val window = windows.remove(agentId) ?: return null
    return window.run.takeIf { clock() - window.readyAt < TASK_WINDOW_MS }
  }

  /** A wake for [run] left the notice [messageId] in [agentId]'s inbox folder. */
  @Synchronized
  fun woke(agentId: String, messageId: Long, run: Run) {
    receipts += Receipt(agentId, messageId, run, clock())
  }

  /** The wakes whose time for a receipt is up (no longer watched); of those, the runs whose notice is still [unread]. */
  fun receiptsDue(unread: (agentId: String, messageId: Long) -> Boolean): List<Run> {
    val due = synchronized(this) {
      val now = clock()
      val (up, waiting) = receipts.partition { now - it.at >= WAKE_RECEIPT_MS }
      receipts.clear()
      receipts += waiting
      up
    }
    return due.filter { unread(it.agentId, it.messageId) }.map { it.run }
  }

  @Synchronized
  fun forget(agentId: String) {
    windows.remove(agentId)
    receipts.removeAll { it.agentId == agentId }
  }

  companion object {
    /** From a start's READY, how long its task check failing fails its run. */
    const val TASK_WINDOW_MS = CheckRules.TASK_WINDOW_MS

    /** A woken agent whose notice is still unread this long after was not woken after all. */
    const val WAKE_RECEIPT_MS = MessageRules.WAKE_START_MS

    const val WAKE_UNTAKEN = "The agent didn't take the task: nothing picked it up within a minute."
    const val TASK_QUIT = "The agent quit right after it started with the task."
  }
}
