package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.ProcessReaper

// Ends one job an agent left running, and only it (the notification's
// "Stop python3 -m http.server"): the job's process (a root AgentWork.jobs
// names) and everything under it get SIGTERM, a wait of up to GRACE_MS
// follows while what they start gets SIGTERM too, then SIGKILL to what is
// left. What carries the job (a proot tracing it, the shell that started
// it) ends by itself once it has nothing left to carry; the agent and its
// other jobs keep running. A job is its pid and its start, as a pid alone
// may be another process by the time Stop is tapped; each process is
// followed the same way, so one that outlives its parent (and gets a new
// one) is still ended. Blocks: callers run it off the main thread.
internal class JobEnd(
  /** The agent processes now (DetailScanner.scan). */
  private val scan: () -> List<ProcDetail>,
  private val signals: ProcessReaper.Signals,
  private val now: () -> Long = System::currentTimeMillis,
  private val sleep: (Long) -> Unit = Thread::sleep,
) {
  /** One job of [agentId]: its root process, by pid and start. */
  data class Ref(val agentId: String, val pid: Int, val startTicks: Long)

  /** False when the job is gone already, or is not that agent's. */
  fun end(job: Ref, graceMs: Long = GRACE_MS): Boolean {
    val first = scan()
    val root = AgentWork.members(first, job.agentId).firstOrNull { it.pid == job.pid && it.startTicks == job.startTicks }
      ?: return false
    // pid → start of every process of the job seen so far.
    val ours = HashMap<Int, Long>()
    ours[root.pid] = root.startTicks
    var left = follow(first, job.agentId, ours)
    for (p in left) signals.term(p)
    val deadline = now() + graceMs
    while (left.isNotEmpty()) {
      if (now() >= deadline) break
      sleep(POLL_MS)
      val before = ours.keys.toSet()
      left = follow(scan(), job.agentId, ours)
      for (p in left) if (p !in before) signals.term(p)
    }
    for (p in left) signals.kill(p)
    return true
  }

  // The job's processes alive in [all]: those already in [ours] (same pid
  // and start), and their children and tracees, added to [ours].
  private fun follow(all: List<ProcDetail>, agentId: String, ours: HashMap<Int, Long>): List<Int> {
    val members = AgentWork.members(all, agentId)
    val alive = members.filter { ours[it.pid] == it.startTicks }.mapTo(HashSet()) { it.pid }
    var grew = true
    while (grew) {
      grew = false
      for (p in members) {
        if (p.pid in alive) continue
        if (p.ppid in alive || (p.tracerPid != 0 && p.tracerPid in alive)) {
          alive += p.pid
          ours[p.pid] = p.startTicks
          grew = true
        }
      }
    }
    return alive.sorted()
  }

  companion object {
    const val GRACE_MS = 3_000L
    private const val POLL_MS = 100L
  }
}
