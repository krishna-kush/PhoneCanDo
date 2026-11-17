package com.phonecando.runner.schedule.reply

import org.junit.Assert.assertEquals
import org.junit.Test

// A finished scheduled run's notice: its title, and its reply's first line.
class ReplyTextTest {
  @Test fun theTitleSaysHowItEnded() {
    assertEquals("Builder: scheduled task done", ReplyText.title("Builder", failed = false))
    assertEquals("Builder: scheduled task stopped with an error", ReplyText.title("Builder", failed = true))
  }

  @Test fun theTextIsTheRepliesFirstLine() {
    assertEquals("All 12 tests pass.", ReplyText.text("\n  All 12 tests pass.  \nDetails below."))
    assertEquals("Summary", ReplyText.text("## Summary\n- fixed it"))
    assertEquals("#hashtag", ReplyText.text("#hashtag"))
    val long = ReplyText.text("y".repeat(200))
    assertEquals(120, long.length)
    assertEquals('…', long.last())
  }

  @Test fun noReplyAsksForATap() {
    assertEquals("Tap to see the result.", ReplyText.text(null))
    assertEquals(ReplyText.NO_TEXT, ReplyText.text(" \n \n"))
    assertEquals(ReplyText.NO_TEXT, ReplyText.text("###   \n"))
  }
}
