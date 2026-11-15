package com.phonecando.runner.schedule

import com.phonecando.runner.messages.MessageRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The runs Firing watches after logging them: a start's task window from
// READY, and a hook or reader wake waiting for its receipt.
class RunWatchTest {
  private var now = 0L
  private val watch = RunWatch { now }
  private val run = RunWatch.Run("s1", 7L)

  @Test fun aTaskFailureInsideTheWindowFailsTheRunOnce() {
    watch.ready("a", run)
    now += RunWatch.TASK_WINDOW_MS - 1
    assertEquals(run, watch.taskFailed("a"))
    assertNull(watch.taskFailed("a"))
  }

  @Test fun aTaskFailurePastTheWindowFailsNothing() {
    watch.ready("a", run)
    now += RunWatch.TASK_WINDOW_MS
    assertNull(watch.taskFailed("a"))
  }

  @Test fun theWindowIsPerAgentAndANewStartReplacesIt() {
    watch.ready("a", run)
    assertNull(watch.taskFailed("b"))
    now += 60_000
    val later = RunWatch.Run("s2", 8L)
    watch.ready("a", later)
    now += RunWatch.TASK_WINDOW_MS - 1
    assertEquals(later, watch.taskFailed("a"))
  }

  @Test fun aWakeStillUnreadAfterAMinuteFails() {
    assertEquals(MessageRules.WAKE_START_MS, RunWatch.WAKE_RECEIPT_MS)
    watch.woke("a", messageId = 41L, run = run)
    now += RunWatch.WAKE_RECEIPT_MS - 1
    assertEquals(emptyList<RunWatch.Run>(), watch.receiptsDue { _, _ -> true })
    now += 1
    assertEquals(listOf(run), watch.receiptsDue { agentId, id -> agentId == "a" && id == 41L })
    // Judged once.
    assertEquals(emptyList<RunWatch.Run>(), watch.receiptsDue { _, _ -> true })
  }

  @Test fun aWakeWithItsReceiptPasses() {
    watch.woke("a", messageId = 41L, run = run)
    now += RunWatch.WAKE_RECEIPT_MS
    assertEquals(emptyList<RunWatch.Run>(), watch.receiptsDue { _, _ -> false })
    assertEquals(emptyList<RunWatch.Run>(), watch.receiptsDue { _, _ -> true })
  }

  @Test fun onlyTheDueWakesAreJudged() {
    watch.woke("a", messageId = 1L, run = run)
    now += 30_000
    val second = RunWatch.Run("s2", 8L)
    watch.woke("b", messageId = 2L, run = second)
    now += RunWatch.WAKE_RECEIPT_MS - 30_000
    assertEquals(listOf(run), watch.receiptsDue { _, _ -> true })
    now += 30_000
    assertEquals(listOf(second), watch.receiptsDue { _, _ -> true })
  }

  @Test fun forgetDropsAnAgentsWatches() {
    watch.ready("a", run)
    watch.woke("a", messageId = 1L, run = run)
    watch.forget("a")
    now += RunWatch.WAKE_RECEIPT_MS
    assertNull(watch.taskFailed("a"))
    assertEquals(emptyList<RunWatch.Run>(), watch.receiptsDue { _, _ -> true })
  }
}
