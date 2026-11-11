package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.term.ScreenRing
import com.phonecando.agents.kit.term.Signal
import com.phonecando.agents.kit.term.TermTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

// JVM checks for EngineTerminal: output drains with or without a viewer, a
// viewer starts with the replay, one viewer at a time, a paused viewer's
// queue is bounded, the end reaches the viewer after its last output, and
// the terminal answers the program: the status query, focus reports that
// follow the viewer showing it, and colour and theme queries from the
// app's theme, with a report when it changes.
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

  @Test fun answersTheStatusQueryEvenBeforeItIsBound() {
    val t = EngineTerminal(24, 80, clock = { now })
    t.out("\u001b]7501;?\u0007")
    assertTrue(pty.written.isEmpty())
    t.bind(pty)
    t.out("\u001b]7501;?\u001b\\\u001b]7501;state=idle\u0007")
    assertEquals(listOf("\u001b]7501;?\u0007", "\u001b]7501;?\u001b\\"), pty.written)
  }

  @Test fun focusFollowsTheViewerThatShowsTheProgram() {
    val t = terminal()
    t.attach("v1")
    t.focus("v1", true)
    assertTrue("no reports before the program asks", pty.written.isEmpty())
    // Asked for while shown: in, at once.
    t.out("\u001b[?1004h")
    t.focus("v1", true)
    t.focus("v1", false)
    t.focus("v1", true)
    assertEquals(listOf("\u001b[I", "\u001b[O", "\u001b[I"), pty.written)
    pty.written.clear()
    // A takeover keeps the focus until the new viewer says; the old one is ignored.
    t.attach("v2")
    t.focus("v1", false)
    assertTrue(pty.written.isEmpty())
    t.focus("v2", false)
    t.detach("v1")
    t.focus("v2", true)
    t.detach("v2")
    assertEquals(listOf("\u001b[O", "\u001b[I", "\u001b[O"), pty.written)
  }

  @Test fun noViewerMeansUnfocused() {
    val t = terminal()
    t.out("\u001b[?1004h")
    assertEquals(listOf("\u001b[O"), pty.written)
    t.attach("v1")
    t.detach("v1")
    assertEquals("attached but never shown: no change", listOf("\u001b[O"), pty.written)
    // A reset turns reports off; after the end nothing is written.
    t.attach("v1")
    t.out("\u001bc")
    t.focus("v1", true)
    t.out("\u001b[?1004h")
    t.onExit(0)
    t.focus("v1", false)
    assertEquals(listOf("\u001b[O", "\u001b[I"), pty.written)
  }

  @Test fun answersFromTheThemeAndReportsAChange() {
    val ansi = List(16) { "#000000" }
    val dark = checkNotNull(TermTheme.of(true, "#e6e6e6", "#0a0a0a", "#00ff00", ansi))
    val light = checkNotNull(TermTheme.of(false, "#1a1a1a", "#ffffff", "#1a7f37", ansi))
    val t = terminal()
    t.out("\u001b]11;?\u0007\u001b[c")
    assertEquals("no theme yet: only the fence", listOf("\u001b[?1;2c"), pty.written)
    pty.written.clear()
    t.theme(dark)
    t.out("\u001b]11;?\u0007\u001b[?2031h")
    t.theme(light)
    t.theme(light)
    assertEquals(listOf("\u001b]11;rgb:0a0a/0a0a/0a0a\u0007", "\u001b[?997;2n"), pty.written)
  }

  @Test fun tailOfTheRing() {
    val t = terminal()
    t.out("hello world")
    val (bytes, cut) = t.tail(5)
    assertEquals("world", bytes.toString(Charsets.UTF_8))
    assertTrue(cut)
  }
}
