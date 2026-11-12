package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.Stdin
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkMeterTest {
  private fun p(pid: Int, startedAt: Long, cpuMs: Long, io: Long? = null) =
    ProcDetail(pid, 1, startedAt, "a1", 0, "x", listOf("x"), Stdin(Stdin.Kind.NULL), cpuMs, io)

  @Test fun activeOnCpuOrBytesSinceTheLastLookAndForAMinuteAfter() {
    val meter = WorkMeter()
    val server = p(20, 0L, cpuMs = 1_000, io = 0)
    // The first look only sets the baseline.
    assertEquals(emptySet<String>(), meter.look(listOf(server), mapOf("a1" to listOf(server)), 30_000))
    // A dev server waiting for requests: a few ms.
    val idle = server.copy(cpuMs = 1_010)
    assertEquals(emptySet<String>(), meter.look(listOf(idle), mapOf("a1" to listOf(idle)), 60_000))
    // A download: little CPU, many bytes.
    val download = idle.copy(cpuMs = 1_020, ioBytes = 5_000_000)
    assertEquals(setOf("a1"), meter.look(listOf(download), mapOf("a1" to listOf(download)), 90_000))
    // Quiet again: still active within ACTIVE_HOLD_MS, then not.
    assertEquals(setOf("a1"), meter.look(listOf(download), mapOf("a1" to listOf(download)), 120_000))
    assertEquals(emptySet<String>(), meter.look(listOf(download), mapOf("a1" to listOf(download)), 151_000))
  }

  @Test fun aProcessBornSinceTheLastLookCountsAllItUsed() {
    val meter = WorkMeter()
    meter.look(emptyList(), mapOf("a1" to emptyList()), 30_000)
    val build = p(21, 40_000L, cpuMs = 900)
    assertEquals(setOf("a1"), meter.look(listOf(build), mapOf("a1" to listOf(build)), 60_000))
  }

  @Test fun aProcessIsKnownByItsKernelStartNotItsEpochStart() {
    // Each read turns the start into epoch ms anew, a ms or two apart.
    val meter = WorkMeter()
    val loop = p(30, 1_000L, cpuMs = 1_000).copy(startTicks = 77)
    meter.look(listOf(loop), mapOf("a1" to listOf(loop)), 30_000)
    val later = loop.copy(startedAt = 1_002L, cpuMs = 1_780)
    assertEquals(setOf("a1"), meter.look(listOf(later), mapOf("a1" to listOf(later)), 60_000))
  }

  @Test fun aReusedPidStartsFresh() {
    val meter = WorkMeter()
    val old = p(21, 1_000L, cpuMs = 50_000)
    meter.look(listOf(old), mapOf("a1" to listOf(old)), 30_000)
    // Same pid, a later start, little CPU: not 50 s used.
    val reused = p(21, 2_000L, cpuMs = 10)
    assertEquals(emptySet<String>(), meter.look(listOf(reused), mapOf("a1" to listOf(reused)), 60_000))
  }
}
