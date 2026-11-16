package com.phonecando.runner.engine.events

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for holding a server's working chats against the chats it
// says it runs, with a fake server: asked only after a quiet span with a
// chat working, at most once per span; what it does not run ends.
class ActiveChatsTest {
  private var now = 1_000_000L
  private var working = listOf("ses_stuck", "ses_long")
  private var running: Set<String>? = setOf("ses_long")
  private var asked = 0
  private val stopped = ArrayList<String>()

  private val active = ActiveChats(
    quietMs = 60_000,
    working = { working },
    ask = { asked++; running },
    stop = { stopped += it },
    clock = { now },
  )

  @Test fun aWorkingChatTheServerDoesNotRunEndsAfterAQuietSpan() {
    active.tick()
    assertEquals(0, asked)
    now += 60_000
    active.tick()
    assertEquals(1, asked)
    // A long quiet command is still running there: it stays.
    assertEquals(listOf("ses_stuck"), stopped)
  }

  @Test fun activityPutsTheQuestionOff() {
    now += 50_000
    active.heard()
    now += 50_000
    active.tick()
    assertEquals(0, asked)
    now += 10_000
    active.tick()
    assertEquals(1, asked)
  }

  @Test fun askedAtMostOncePerSpan() {
    now += 60_000
    active.tick()
    now += 30_000
    active.tick()
    assertEquals(1, asked)
    now += 30_000
    active.tick()
    assertEquals(2, asked)
  }

  @Test fun nothingWorkingOrNoAnswerChangesNothing() {
    working = emptyList()
    now += 60_000
    active.tick()
    assertEquals(0, asked)
    working = listOf("ses_stuck")
    running = null
    active.tick()
    assertEquals(1, asked)
    assertTrue(stopped.isEmpty())
  }
}
