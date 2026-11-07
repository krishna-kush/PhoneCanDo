package com.phonecando.runner.engine.proc

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the stop sequence: SIGTERM to every tagged process (also
// ones that appear during the wait), SIGKILL only to what outlives the grace.
class ProcessReaperTest {
  private val uid = 10123
  private val me = 1
  private var clock = 0L
  private val alive = LinkedHashMap<Int, String>() // pid -> tag
  private val terms = ArrayList<Int>()
  private val kills = ArrayList<Int>()
  private val stubborn = HashSet<Int>()
  private val signals = object : ProcessReaper.Signals {
    override fun term(pid: Int) {
      terms += pid
      if (pid !in stubborn) alive.remove(pid)
    }

    override fun kill(pid: Int) {
      kills += pid
      alive.remove(pid)
    }
  }
  private var onSleep: () -> Unit = {}
  private val reaper = ProcessReaper(
    scan = { alive.map { (pid, tag) -> ProcEntry(pid, uid, false, tag) } },
    signals = signals,
    myPid = me,
    myUid = uid,
    now = { clock },
    sleep = { clock += it; onSleep() },
  )

  @Test fun nothingTaggedReturnsAtOnce() {
    alive[7] = "other"
    assertEquals(emptyList<Int>(), reaper.stop(emptyList(), setOf("a1")))
    assertEquals(emptyList<Int>(), terms)
    assertEquals(0L, clock)
  }

  @Test fun termsEveryTaggedProcessOfTheAgent() {
    alive[10] = "a1"
    alive[11] = "a1"
    alive[12] = "a2"
    assertEquals(emptyList<Int>(), reaper.stop(emptyList(), setOf("a1")))
    assertEquals(listOf(10, 11), terms)
    assertEquals(mapOf(12 to "a2"), alive)
    assertTrue(kills.isEmpty())
  }

  @Test fun killsWhatOutlivesTheGrace() {
    alive[10] = "a1"
    alive[11] = "a2"
    stubborn += 10
    val killed = reaper.stop(emptyList(), null)
    assertEquals(listOf(10), killed)
    assertEquals(listOf(10), kills)
    assertTrue(clock >= ProcessReaper.GRACE_MS)
    assertTrue(alive.isEmpty())
  }

  @Test fun aChildBornDuringTheWaitIsTermedToo() {
    alive[10] = "a1"
    stubborn += 10
    onSleep = {
      if (clock == 100L) alive[20] = "a1"
      if (clock == 500L) stubborn -= 10
    }
    reaper.stop(emptyList(), setOf("a1"))
    assertEquals(listOf(10, 20), terms)
    assertTrue(kills.isEmpty() || kills == listOf(10))
    assertTrue(20 !in alive)
  }

  @Test fun anyTagged() {
    alive[me] = "a1"
    assertEquals(false, reaper.anyTagged(null))
    alive[30] = "a3"
    assertEquals(true, reaper.anyTagged(null))
    assertEquals(false, reaper.anyTagged(setOf("a1")))
  }
}
