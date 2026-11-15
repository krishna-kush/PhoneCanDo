package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class ReadyLinesTest {
  @Test fun itNamesTheAgentsReady() {
    assertEquals("opencode ready", ReadyLines.of(listOf("opencode")))
    assertEquals("Claude Code, opencode ready", ReadyLines.of(listOf("Claude Code", "opencode")))
    assertEquals("Claude Code, opencode, Codex ready", ReadyLines.of(listOf("Claude Code", "opencode", "Codex")))
  }

  @Test fun pastThreeItCountsTheRest() {
    assertEquals(
      "Claude Code, opencode, Codex and 2 more ready",
      ReadyLines.of(listOf("Claude Code", "opencode", "Codex", "Goose", "pi")),
    )
  }

  @Test fun theLockScreenGetsTheCountOnly() {
    assertEquals("1 agent ready", ReadyLines.count(1))
    assertEquals("2 agents ready", ReadyLines.count(2))
  }
}
