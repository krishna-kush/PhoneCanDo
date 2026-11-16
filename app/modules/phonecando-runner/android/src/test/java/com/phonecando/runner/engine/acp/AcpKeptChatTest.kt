package com.phonecando.runner.engine.acp

import com.phonecando.runner.engine.acp.AcpKeptChat.Act
import com.phonecando.runner.engine.acp.AcpKeptChat.Untried
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the chat ACP mode keeps: a new chat stays kept once a turn
// in it was answered; its first turn ending unanswered gives back the chat
// kept before it, or none, as the agent may have dropped the new one.
class AcpKeptChatTest {
  @Test fun aTurnIsAnsweredByAStopReasonOtherThanCancelled() {
    assertTrue(AcpKeptChat.answered("end_turn", null))
    assertTrue(AcpKeptChat.answered("max_tokens", null))
    assertFalse(AcpKeptChat.answered("cancelled", null))
    assertFalse(AcpKeptChat.answered(null, "Rate limit exceeded. Try again later."))
    assertFalse(AcpKeptChat.answered(null, null))
  }

  @Test fun anAnsweredTurnKeepsTheNewChat() {
    assertEquals(Act.Nothing, AcpKeptChat.afterTurn(Untried("new", before = "old"), "new", answered = true))
  }

  @Test fun anUnansweredFirstTurnGivesBackTheChatBeforeOrNone() {
    assertEquals(Act.Keep("old"), AcpKeptChat.afterTurn(Untried("new", before = "old"), "new", answered = false))
    // The kept chat failed to load and was forgotten: none to give back.
    assertEquals(Act.Forget, AcpKeptChat.afterTurn(Untried("new", before = null), "new", answered = false))
  }

  @Test fun aReopenedChatOrOneLeftBehindIsLeftAlone() {
    assertEquals(Act.Nothing, AcpKeptChat.afterTurn(null, "kept", answered = false))
    assertEquals(Act.Nothing, AcpKeptChat.afterTurn(Untried("new", before = "old"), "newer", answered = false))
  }
}
