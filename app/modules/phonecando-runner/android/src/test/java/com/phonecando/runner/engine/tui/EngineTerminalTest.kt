package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.term.ScreenRing
import com.phonecando.agents.kit.term.Signal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

// JVM checks for EngineTerminal: output drains with or without a viewer, a
// viewer starts with the replay, one viewer at a time, a paused viewer's
// queue is bounded, and the end reaches the viewer after its last output.
class EngineTerminalTest {
  private var now = 1_000L
  private val pty = FakePty()
  private val ris = "\u001bc"

  private fun terminal(queueCap: Int = EngineTerminal.QUEUE_CAP) =
    EngineTerminal(24, 80, clock = { now }, ring = ScreenRing(), queueCap = queueCap).also { it.bind(pty) }

  private fun EngineTerminal.out(text: String) {
    val bytes = text.toByteArray(Charsets.UTF_8)
    // The reader reuses its buffer: what the terminal keeps must be a copy.
    val buf = bytes.copyOf(bytes.size + 8)
    onOutput(buf, bytes.size)
    buf.fill('#'.code.toByte())
  }

  private fun EngineTerminal.readAll(viewer: String): String {
    val out = StringBuilder()
    while (true) out.append((read(viewer, 7) ?: return out.toString()).toString(Charsets.UTF_8))
  }

  private fun refusal(code: String, block: () -> Unit) {
    try {
      block()
      fail("expected $code")
    } catch (e: TerminalViewException) {
      assertEquals(code, e.code)
      assertTrue(e.message!!.startsWith("$code: "))
    }
  }

  @Test fun aViewerStartsWithTheReplayThenLiveOutput() {
    val t = terminal()
    t.out("\u001b]0;Fix login\u0007hello ")
    assertEquals(1_000L, t.lastOutputAt)
    assertEquals("Fix login", t.windowTitle)
    assertEquals(EngineTerminal.Size(24, 80), t.attach("v1"))
    assertEquals("$ris\u001b]0;Fix login\u0007hello ", t.readAll("v1"))
    assertNull(t.read("v1", 10))
    now = 2_000L
    t.out("world")
    assertEquals("world", t.readAll("v1"))
    assertEquals(2_000L, t.lastOutputAt)
  }

  @Test fun oneViewerAtATime() {
    val t = terminal()
    t.out("a")
    t.attach("v1")
    t.attach("v2")
    refusal(TerminalViewException.DETACHED) { t.read("v1", 10) }
    // A replaced viewer's keys and sizes go nowhere.
    t.write("v1", "ignored".toByteArray())
    t.resize("v1", 1, 1)
    t.write("v2", "ls\r".toByteArray())
    assertEquals(listOf("ls\r"), pty.written)
    t.resize("v2", 40, 100)
    t.resize("v2", 40, 100)
    assertEquals(listOf(40 to 100, 40 to 100), pty.sizes)
    assertEquals(EngineTerminal.Size(40, 100), t.attach("v3"))
    t.detach("v2")
    assertTrue(t.holds("v3"))
    t.detach("v3")
    refusal(TerminalViewException.DETACHED) { t.read("v3", 10) }
  }

  @Test fun aPausedViewersQueueIsReplacedByAFreshReplay() {
    val t = terminal(queueCap = 32)
    t.attach("v1")
    t.read("v1", 100)
    repeat(10) { t.out("0123456789") }
    // Past the cap, the queue is the replay: prologue plus the ring.
    assertEquals(ris + "0123456789".repeat(10), t.readAll("v1"))
  }

  @Test fun theEndComesAfterTheLastOutput() {
    val t = terminal()
    t.attach("v1")
    t.read("v1", 100)
    t.out("bye")
    t.onExit(0)
    assertEquals(0, t.exitStatus)
    assertEquals(0, t.awaitExit())
    assertEquals("bye", t.read("v1", 10)!!.toString(Charsets.UTF_8))
    refusal(TerminalViewException.ENDED) { t.read("v1", 10) }
    t.write("v1", "x".toByteArray())
    assertTrue(pty.written.isEmpty())
    refusal(TerminalViewException.NOT_RUNNING) { t.attach("v2") }
  }

  @Test fun signalsGoToTheListener() {
    val t = terminal()
    val seen = ArrayList<Signal>()
    t.out("\u0007")
    t.listen { seen += it }
    t.out("x\u0007\u001b]2;t\u0007")
    t.listen(null)
    t.out("\u0007")
    assertEquals(listOf(Signal.Bell, Signal.Title("t")), seen)
  }

  @Test fun tailOfTheRing() {
    val t = terminal()
    t.out("hello world")
    val (bytes, cut) = t.tail(5)
    assertEquals("world", bytes.toString(Charsets.UTF_8))
    assertTrue(cut)
  }
}
