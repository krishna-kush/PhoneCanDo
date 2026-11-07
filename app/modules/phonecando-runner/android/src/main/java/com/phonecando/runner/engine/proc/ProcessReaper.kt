package com.phonecando.runner.engine.proc

// Ends engines and everything they started: SIGTERM to each engine process
// we hold and to every tagged process (TaggedProcesses), a wait of up to
// GRACE_MS while new tagged processes get SIGTERM too, then SIGKILL to what
// is left. One wait covers every target, so stopping all agents takes as
// long as stopping one. Blocks: callers run it off the main thread. Pure
// apart from what is passed in (ProcScanner and Os.kill on the phone).
class ProcessReaper(
  private val scan: () -> List<ProcEntry>,
  private val signals: Signals,
  private val myPid: Int,
  private val myUid: Int,
  private val now: () -> Long = System::currentTimeMillis,
  private val sleep: (Long) -> Unit = Thread::sleep,
) {
  interface Signals {
    fun term(pid: Int)

    fun kill(pid: Int)
  }

  /** [agentIds] null: processes of any agent. Returns the pids that needed SIGKILL. */
  fun stop(engines: List<Process>, agentIds: Set<String>?, graceMs: Long = GRACE_MS): List<Int> {
    for (p in engines) runQuietly { p.destroy() }
    val termed = HashSet<Int>()
    var left = tagged(agentIds)
    for (pid in left) if (termed.add(pid)) signals.term(pid)
    val deadline = now() + graceMs
    while (left.isNotEmpty() || engines.any { it.isAlive }) {
      if (now() >= deadline) break
      sleep(POLL_MS)
      left = tagged(agentIds)
      for (pid in left) if (termed.add(pid)) signals.term(pid)
    }
    for (pid in left) signals.kill(pid)
    for (p in engines) if (p.isAlive) runQuietly { p.destroyForcibly() }
    return left
  }

  /** True while any process tagged with one of [agentIds] (null: any agent) is alive. */
  fun anyTagged(agentIds: Set<String>?): Boolean = tagged(agentIds).isNotEmpty()

  private fun tagged(agentIds: Set<String>?): List<Int> = try {
    TaggedProcesses.select(scan(), agentIds, myPid, myUid)
  } catch (_: Exception) {
    emptyList()
  }

  private inline fun runQuietly(block: () -> Unit) {
    try {
      block()
    } catch (_: Exception) {
    }
  }

  companion object {
    const val GRACE_MS = 3_000L
    private const val POLL_MS = 100L
  }
}
