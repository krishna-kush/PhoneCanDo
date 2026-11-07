package com.phonecando.runner.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Bearer token -> calling agent, with several agents running.
class CallerAuthTest {
  private val one = agent("a1", "opencode", "tok-one")
  private val two = agent("a2", "opencode 2", "tok-two")
  private val dir = FakeDirectory(one, two)

  @Test fun eachTokenNamesItsAgent() {
    assertEquals(one, CallerAuth.caller("Bearer tok-one", dir))
    assertEquals(two, CallerAuth.caller("Bearer tok-two", dir))
  }

  @Test fun unknownOrMalformedTokensMatchNobody() {
    assertNull(CallerAuth.caller("Bearer tok-three", dir))
    assertNull(CallerAuth.caller("Bearer tok-on", dir))
    assertNull(CallerAuth.caller("tok-one", dir))
    assertNull(CallerAuth.caller("Basic tok-one", dir))
    assertNull(CallerAuth.caller("Bearer ", dir))
    assertNull(CallerAuth.caller(null, dir))
  }

  @Test fun anAgentWithoutATokenNeverMatches() {
    val blank = FakeDirectory(agent("a3", token = ""))
    assertNull(CallerAuth.caller("Bearer ", blank))
    assertNull(CallerAuth.caller("Bearer x", blank))
  }

  @Test fun aStoppedEngineStopsAuthenticating() {
    val live = FakeDirectory(one, two)
    live.records.remove(two)
    assertNull(CallerAuth.caller("Bearer tok-two", live))
    assertEquals(one, CallerAuth.caller("Bearer tok-one", live))
  }
}
