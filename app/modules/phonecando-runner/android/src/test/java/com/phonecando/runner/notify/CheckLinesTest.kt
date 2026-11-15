package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// A capability's first failure and a Check now's end, as their notifications say them.
class CheckLinesTest {
  @Test fun titleNamesTheAgentAndTheCapability() {
    assertEquals("Claude: Phone tools isn't working", CheckLines.title("Claude", "tools"))
    assertEquals("Gem: Messages during ACP turns isn't working", CheckLines.title("Gem", "acpMessages"))
    assertEquals("Gem: Starts with a task isn't working", CheckLines.title("Gem", "task"))
  }

  @Test fun everyCapabilityHasALabel() {
    for (wire in listOf("tools", "messages", "wake", "task", "state", "acp", "acpTools", "acpMessages", "chat")) {
      assertNotEquals("no label for $wire", wire, CheckLines.label(wire))
    }
    assertEquals("later", CheckLines.label("later"))
  }

  @Test fun textIsTheDetailOrAPointer() {
    assertEquals("It quit with exit 1.", CheckLines.text("  It quit with exit 1. "))
    assertEquals(CheckLines.NO_DETAIL, CheckLines.text(null))
    assertEquals(CheckLines.NO_DETAIL, CheckLines.text(" "))
  }

  @Test fun aCheckNowsEnd() {
    assertEquals("Claude: check done", CheckLines.runTitle("Claude", done = true))
    assertEquals("Claude: check stopped", CheckLines.runTitle("Claude", done = false))
    assertEquals("3 checked, 1 not working", CheckLines.runText(3, 1, 0))
    assertEquals("2 checked, 0 not working, 4 couldn't tell", CheckLines.runText(2, 0, 4))
  }
}
