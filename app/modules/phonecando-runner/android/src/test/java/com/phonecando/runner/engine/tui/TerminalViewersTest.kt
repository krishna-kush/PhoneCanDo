package com.phonecando.runner.engine.tui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.fail
import org.junit.Test

// JVM checks for TerminalViewers: ids, the codes JS matches, and that ids
// that can never read again are forgotten.
class TerminalViewersTest {
  private val viewers = TerminalViewers()

  private fun terminal() = EngineTerminal(30, 90).also { it.bind(FakePty()) }

  private fun code(block: () -> Unit): String = try {
    block()
    fail("expected a refusal")
    ""
  } catch (e: TerminalViewException) {
    e.code
  }

  @Test fun attachReadDetach() {
    val t = terminal()
    val a = viewers.attach(t)
    assertEquals(30, a.rows)
    assertEquals(90, a.cols)
    assertEquals("\u001bc", viewers.read(a.viewerId, 100)!!.toString(Charsets.UTF_8))
    viewers.detach(a.viewerId)
    assertEquals(TerminalViewException.DETACHED, code { viewers.read(a.viewerId, 100) })
    assertEquals(TerminalViewException.DETACHED, code { viewers.read("v999", 100) })
  }

  @Test fun aReplacedViewerIsDetachedThenForgotten() {
    val t = terminal()
    val a = viewers.attach(t)
    val b = viewers.attach(t)
    assertNotEquals(a.viewerId, b.viewerId)
    assertEquals(TerminalViewException.DETACHED, code { viewers.read(a.viewerId, 100) })
    viewers.read(b.viewerId, 100)
    // A new life of the engine: the old view ends once its output is read.
    t.onExit(1)
    assertEquals(TerminalViewException.ENDED, code { viewers.read(b.viewerId, 100) })
    assertEquals(TerminalViewException.DETACHED, code { viewers.read(b.viewerId, 100) })
    assertEquals(TerminalViewException.NOT_RUNNING, code { viewers.attach(t) })
  }
}
