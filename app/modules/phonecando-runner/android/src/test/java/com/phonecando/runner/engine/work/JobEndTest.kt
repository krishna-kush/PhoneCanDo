package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.engine.proc.Stdin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for one job's stop: its process and what is under it get
// SIGTERM, the agent, the job's carriers and other jobs do not; a process
// started during the wait gets SIGTERM too; only what outlives the grace
// gets SIGKILL; a pid that is another process now is left alone.
class JobEndTest {
  private var clock = 0L
  private val alive = LinkedHashMap<Int, ProcDetail>()
  private val terms = ArrayList<Int>()
  private val kills = ArrayList<Int>()
  private val stubborn = HashSet<Int>()
  private var onSleep: () -> Unit = {}
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
  private val end = JobEnd(
    scan = { alive.values.toList() },
    signals = signals,
    now = { clock },
    sleep = { clock += it; onSleep() },
  )

  private fun add(pid: Int, ppid: Int, start: Long, vararg argv: String, tag: String? = "a1", tracer: Int = 0) {
    alive[pid] = ProcDetail(pid, ppid, start, tag, tracer, argv.first(), argv.toList(), Stdin(Stdin.Kind.NULL), 0L, startTicks = start)
  }

  // The engine, a proot carrying `bash -c` that runs python's server, and a second job.
  private fun agentWithServer() {
    add(10, 1, 100, "liboc-engine.so", "serve")
    add(20, 10, 200, "libproot.so", "-L")
    add(21, 20, 201, "bash", "-c", "python3 -m http.server", tracer = 20)
    add(22, 21, 202, "python3", "-m", "http.server", tracer = 20)
    add(30, 10, 300, "npm", "run", "dev")
  }

  @Test fun endsTheJobAndWhatIsUnderItOnly() {
    agentWithServer()
    add(23, 22, 203, "python3", "-c", "worker", tracer = 20)
    assertTrue(end.end(JobEnd.Ref("a1", 22, 202)))
    assertEquals(listOf(22, 23), terms)
    assertEquals(emptyList<Int>(), kills)
    assertTrue(10 in alive && 20 in alive && 21 in alive && 30 in alive)
  }

  @Test fun aProcessStartedDuringTheWaitIsEndedToo() {
    agentWithServer()
    stubborn += 22
    onSleep = { if (40 !in alive && clock == 100L) add(40, 22, 400, "python3", "-c", "late", tracer = 20) }
    end.end(JobEnd.Ref("a1", 22, 202))
    assertTrue(40 in terms)
    assertEquals(listOf(22), kills)
  }

  @Test fun onlyWhatOutlivesTheGraceIsKilled() {
    agentWithServer()
    stubborn += 22
    end.end(JobEnd.Ref("a1", 22, 202))
    assertEquals(listOf(22), terms)
    assertEquals(listOf(22), kills)
    assertTrue(clock >= JobEnd.GRACE_MS)
  }

  @Test fun aChildLeftWithoutItsParentIsStillFollowed() {
    agentWithServer()
    add(23, 22, 203, "python3", "-c", "worker", tracer = 20)
    stubborn += 23
    // The server ends; its child is handed to init.
    onSleep = { alive[23]?.let { alive[23] = it.copy(ppid = 1) } }
    end.end(JobEnd.Ref("a1", 22, 202))
    assertEquals(listOf(23), kills)
  }

  @Test fun aReusedPidIsLeftAlone() {
    agentWithServer()
    assertFalse(end.end(JobEnd.Ref("a1", 22, 999)))
    assertEquals(emptyList<Int>(), terms)
  }

  @Test fun anotherAgentsJobIsLeftAlone() {
    agentWithServer()
    add(50, 1, 500, "python3", "-m", "http.server", tag = "a2")
    assertFalse(end.end(JobEnd.Ref("a1", 50, 500)))
    assertTrue(50 in alive)
  }
}
