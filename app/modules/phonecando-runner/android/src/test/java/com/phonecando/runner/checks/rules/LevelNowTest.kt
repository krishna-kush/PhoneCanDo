package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.MessagingLevel
import org.junit.Assert.assertEquals
import org.junit.Test

// The level shown everywhere drops, one step at a time, to what works.
class LevelNowTest {
  private val all = Capability.values().toSet()

  @Test fun allOkKeepsTheDeclaredLevel() {
    for (level in MessagingLevel.values()) assertEquals(level, LevelNow.of(level, all))
  }

  @Test fun wakesStaysWithWakeOrAcp() {
    assertEquals(MessagingLevel.WAKES, LevelNow.of(MessagingLevel.WAKES, all - Capability.ACP))
    assertEquals(MessagingLevel.WAKES, LevelNow.of(MessagingLevel.WAKES, all - Capability.WAKE))
    assertEquals(MessagingLevel.DELIVERED, LevelNow.of(MessagingLevel.WAKES, all - Capability.WAKE - Capability.ACP))
  }

  @Test fun deliveredStaysWithMessagesOrAcp() {
    assertEquals(MessagingLevel.DELIVERED, LevelNow.of(MessagingLevel.DELIVERED, all - Capability.ACP))
    assertEquals(MessagingLevel.DELIVERED, LevelNow.of(MessagingLevel.DELIVERED, all - Capability.MESSAGES))
    assertEquals(MessagingLevel.INBOX, LevelNow.of(MessagingLevel.DELIVERED, setOf(Capability.TOOLS, Capability.WAKE)))
    // A failed wake and failed messages: down two steps.
    assertEquals(MessagingLevel.INBOX, LevelNow.of(MessagingLevel.WAKES, setOf(Capability.TOOLS)))
  }

  @Test fun inboxStaysWithTools() {
    assertEquals(MessagingLevel.INBOX, LevelNow.of(MessagingLevel.INBOX, setOf(Capability.TOOLS)))
    assertEquals(MessagingLevel.NONE, LevelNow.of(MessagingLevel.INBOX, all - Capability.TOOLS))
    assertEquals(MessagingLevel.NONE, LevelNow.of(MessagingLevel.WAKES, emptySet()))
    assertEquals(MessagingLevel.NONE, LevelNow.of(MessagingLevel.NONE, all))
  }
}
