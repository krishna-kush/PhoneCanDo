package com.phonecando.runner.cutoff

import com.phonecando.runner.cutoff.BringRules.Kind
import com.phonecando.runner.cutoff.BringRules.Plan
import com.phonecando.runner.cutoff.CutOffLook.Why
import com.phonecando.runner.engine.EngineMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for how a run cut off goes on, row by row, how often an agent
// may be brought back, and the words it shows and reads.
class BringRulesTest {
  private val claude = Kind(server = false, acp = true, prompts = true, resumes = true, wakesByServer = false)
  private val opencode = Kind(server = true, acp = false, prompts = false, resumes = false, wakesByServer = true)
  private val aider = Kind(server = false, acp = false, prompts = false, resumes = true, wakesByServer = false)
  private val cline = Kind(server = false, acp = true, prompts = true, resumes = false, wakesByServer = false)

  @Test fun eachModeGoesOnInItsChat() {
    assertEquals(Plan.START_ACP, BringRules.plan(EngineMode.ACP, claude, listOf("c1")))
    assertEquals(Plan.START_WITH_PROMPT, BringRules.plan(EngineMode.TERMINAL, claude, listOf(null)))
    assertEquals(Plan.START_THEN_POST, BringRules.plan(EngineMode.TERMINAL, opencode, listOf("ses_1")))
  }

  @Test fun whatCannotGoOnByItselfIsOpened() {
    // No start prompt (aider), no resume args (cline: a new chat would not know the task).
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.TERMINAL, aider, listOf(null)))
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.TERMINAL, cline, listOf(null)))
    // ACP mode or a server without a chat to name, a kind that has no ACP mode now, a kind gone.
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.ACP, claude, listOf(null)))
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.TERMINAL, opencode, listOf(null)))
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.ACP, aider, listOf("c1")))
    assertEquals(Plan.OPEN, BringRules.plan(EngineMode.TERMINAL, null, listOf(null)))
  }

  @Test fun continueWaitsForACheckAnInstallAndOtherStarts() {
    assertEquals(CutOffText.CHECKING, BringRules.waitFor(checking = true, installing = true, starting = true))
    assertEquals(CutOffText.INSTALLING, BringRules.waitFor(checking = false, installing = true, starting = true))
    assertEquals(CutOffText.WAIT, BringRules.waitFor(checking = false, installing = false, starting = true))
    assertEquals(null, BringRules.waitFor(checking = false, installing = false, starting = false))
  }

  @Test fun twiceInSixHoursIsSpent() {
    val now = 10 * BringRules.WINDOW_MS
    var brought = BringRules.add(emptyMap(), "a1", now - BringRules.WINDOW_MS)
    assertEquals(0, BringRules.count(brought, "a1", now))
    brought = BringRules.add(brought, "a1", now - 1_000)
    assertEquals(1, BringRules.count(brought, "a1", now))
    assertFalse(BringRules.spent(brought, "a1", now))
    brought = BringRules.add(brought, "a1", now)
    assertTrue(BringRules.spent(brought, "a1", now))
    assertFalse(BringRules.spent(brought, "a2", now))
    assertEquals(emptyMap<String, List<Long>>(), BringRules.prune(brought, now + BringRules.WINDOW_MS + 1))
  }

  @Test fun theWords() {
    assertEquals("Builder: cut off mid-task", CutOffText.title("Builder"))
    assertEquals(
      "The phone restarted while it worked on “fix the build”. Continue in the same chat?",
      CutOffText.text(Why.REBOOT, "fix the build", CutOffText.CONTINUE),
    )
    assertEquals("It stopped by itself while it was working. Open it to go on.", CutOffText.text(Why.DIED, null, CutOffText.OPEN))
    assertEquals("It did not start (not ready after 120 s). Open it to go on.", CutOffText.failed("not ready after 120 s"))
    assertEquals("It did not start. Open it to go on.", CutOffText.failed(" "))
    assertEquals("The phone is short of memory. Continue once there is room.", CutOffText.noRoom("the phone is short of memory"))
    assertTrue(CutOffText.goOn(Why.UPDATE).startsWith("Note from PhoneCanDo: PhoneCanDo was updated while you were working in this chat"))
    assertEquals("brought back at 10:42", CutOffText.broughtNote("10:42"))
  }
}
