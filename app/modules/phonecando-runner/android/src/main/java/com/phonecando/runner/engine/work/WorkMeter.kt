package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail

// Whether an agent's jobs are doing something, from one look to the next:
// the CPU they used (their reaped children's too) and the bytes they read
// and wrote (sockets count, so a download does). Active over ACTIVE_CPU_MS
// or ACTIVE_IO_BYTES since the last look, and for ACTIVE_HOLD_MS after. A
// dev server waiting for requests is a job but not active: the phone may
// sleep under it. A process is known by pid and kernel start ticks, so a
// reused pid starts fresh. Not thread-safe: WorkWatch's thread only.
class WorkMeter {
  private data class Key(val pid: Int, val startTicks: Long)

  private data class Sample(val cpuMs: Long, val ioBytes: Long?)

  private var last = HashMap<Key, Sample>()
  private var lastAt: Long? = null
  private val activeUntil = HashMap<String, Long>()

  /**
   * One look: [all] our processes now, [jobs] each agent's work (AgentWork).
   * The agents whose jobs are active.
   */
  fun look(all: List<ProcDetail>, jobs: Map<String, List<ProcDetail>>, now: Long): Set<String> {
    val before = last
    val since = lastAt
    last = all.associateTo(HashMap()) { Key(it.pid, it.startTicks) to Sample(it.cpuMs, it.ioBytes) }
    lastAt = now
    activeUntil.keys.retainAll(jobs.keys)
    for ((agentId, procs) in jobs) {
      var cpu = 0L
      var io = 0L
      for (p in procs) {
        val prev = before[Key(p.pid, p.startTicks)]
        when {
          prev != null -> {
            cpu += (p.cpuMs - prev.cpuMs).coerceAtLeast(0L)
            if (p.ioBytes != null && prev.ioBytes != null) io += (p.ioBytes - prev.ioBytes).coerceAtLeast(0L)
          }
          // Born since the last look: all it did, it did since.
          since != null && p.startedAt >= since -> {
            cpu += p.cpuMs
            io += p.ioBytes ?: 0L
          }
        }
      }
      if (cpu >= WorkRules.ACTIVE_CPU_MS || io >= WorkRules.ACTIVE_IO_BYTES) activeUntil[agentId] = now + WorkRules.ACTIVE_HOLD_MS
    }
    return activeUntil.filterValues { it > now }.keys
  }
}
