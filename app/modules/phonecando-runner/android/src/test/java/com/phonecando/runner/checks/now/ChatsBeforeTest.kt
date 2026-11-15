package com.phonecando.runner.checks.now

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// The chat an agent gets back after its check: the kept one, else what
// its ACP part would have gone back to; given back once.
class ChatsBeforeTest {
  private val chats = ChatsBefore()

  @Test fun theKeptChatWinsOverTheAcpPartsNote() {
    chats.began("a", kept = "mine")
    chats.noted("a", "listed")
    assertEquals("mine", chats.take("a"))
    assertNull(chats.take("a"))
  }

  @Test fun withNoKeptChatTheAcpPartsNoteIsGivenBack() {
    chats.began("a", kept = null)
    chats.noted("a", null)
    chats.noted("a", "listed")
    // A later part's driver (or none) changes nothing.
    chats.noted("a", "check")
    assertEquals("listed", chats.take("a"))
  }

  @Test fun aNewCheckForgetsTheLastOnesNote() {
    chats.began("a", kept = null)
    chats.noted("a", "old")
    chats.began("a", kept = null)
    assertNull(chats.take("a"))
    // Agents are apart.
    chats.began("b", kept = "b1")
    assertNull(chats.take("a"))
    assertEquals("b1", chats.take("b"))
  }
}
