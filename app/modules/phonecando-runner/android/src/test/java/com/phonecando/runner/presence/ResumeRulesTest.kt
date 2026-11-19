package com.phonecando.runner.presence

import com.phonecando.runner.presence.ResumeRules.Way
import org.junit.Assert.assertEquals
import org.junit.Test

// How the note to go on reaches a running agent: a notice, a TUI started
// again in the same chat with it, a switch to ACP mode in the chat the
// terminal left, or the note left for its next turn.
class ResumeRulesTest {
  // Codex idle in its terminal after a Stop: no ACP mode, no wake of its own.
  private val codex = ResumeRules.State(
    ready = true, idle = true, acpMode = false, kindWakes = false, jobs = false, restartable = true, acpKind = false,
    acpLists = false,
  )

  // Kimi Code idle in its terminal: no first prompt there, an ACP mode that lists its chats.
  private val kimi = codex.copy(restartable = false, acpKind = true, acpLists = true)

  @Test fun anIdleTuiThatTakesAFirstPromptStartsAgainWithTheNote() {
    assertEquals(Way.RESTART, ResumeRules.decide(codex))
    // Its ACP mode doesn't matter: a restart keeps the chat for sure.
    assertEquals(Way.RESTART, ResumeRules.decide(codex.copy(acpKind = true, acpLists = true)))
  }

  @Test fun anIdleTuiWithNoFirstPromptGoesOnInAcpModeWhenThatFindsItsChat() {
    assertEquals(Way.SWITCH, ResumeRules.decide(kimi))
    // Gemini CLI: its ACP mode lists no chats, so a switch would land in a new one.
    assertEquals(Way.WAIT, ResumeRules.decide(kimi.copy(acpLists = false)))
    assertEquals(Way.WAIT, ResumeRules.decide(codex.copy(restartable = false)))
  }

  @Test fun aRunGoingOrAStartTakesTheNoticeInItsTurn() {
    assertEquals(Way.NOTICE, ResumeRules.decide(codex.copy(idle = false)))
    assertEquals(Way.NOTICE, ResumeRules.decide(kimi.copy(ready = false)))
  }

  @Test fun whatWakesItAlreadyGetsTheNotice() {
    assertEquals(Way.NOTICE, ResumeRules.decide(kimi.copy(acpMode = true)))
    assertEquals(Way.NOTICE, ResumeRules.decide(codex.copy(kindWakes = true)))
  }

  @Test fun jobsKeepItAsItIs() {
    assertEquals(Way.NOTICE, ResumeRules.decide(codex.copy(jobs = true)))
    assertEquals(Way.NOTICE, ResumeRules.decide(kimi.copy(jobs = true)))
  }
}
