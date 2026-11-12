package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.Stdin

// Which of an agent's processes are work it left running (a dev server,
// `nohup … &`, a background task) and which are the agent itself, for
// every kind without per-kind code. The agent is what ran when the user
// first spoke to it in this engine life (its program, a wrapper shell, MCP
// servers it started up front). Anything born later and older than
// MIN_AGE_MS is work, unless it is a stdio helper: not a shell, not under a
// job, and its stdin a pipe the agent (or another helper) writes, or a
// socket from such a parent. That is how MCP stdio servers and language
// servers run; commands get /dev/null, a terminal or a file. A shell, a
// command of the agent's own shell, an orphan or daemon (its parent gone),
// and whatever a job starts are work. In doubt it is work: a wrong "work"
// keeps an agent up (the notification names it, with Stop), a wrong
// "helper" kills a job. Pure.
object AgentWork {
  enum class Verdict { OWN, YOUNG, HELPER, WORK }

  data class Judged(val proc: ProcDetail, val verdict: Verdict, val why: String)

  /** The agent's processes: tagged with [agentId], or untagged and traced by one that is (a guest that cleared its env). */
  fun members(all: List<ProcDetail>, agentId: String): List<ProcDetail> {
    val tracers = all.filter { it.tag == agentId }.mapTo(HashSet()) { it.pid }
    return all.filter { it.tag == agentId || (it.tag == null && it.tracerPid != 0 && it.tracerPid in tracers) }
  }

  /** The pipe inodes [judge] asks writers for: stdin of members that may be helpers. */
  fun pipesToCheck(members: List<ProcDetail>, firstInputAt: Long?): Set<Long> {
    if (firstInputAt == null) return emptySet()
    return members.filter { it.startedAt >= firstInputAt && it.stdin.kind == Stdin.Kind.PIPE }
      .mapNotNullTo(HashSet()) { it.stdin.inode }
  }

  /**
   * Each of [members] judged, oldest first. [firstInputAt]: epoch ms of the
   * user's first input in this engine life, null before it (all is the
   * agent's). [writers]: per pipe inode, the members holding it open for
   * writing (DetailScanner.pipeWriters); null when unreadable, then a pipe
   * from the parent counts as the agent's.
   */
  fun judge(members: List<ProcDetail>, firstInputAt: Long?, now: Long, writers: Map<Long, Set<Int>>?): List<Judged> {
    val byPid = members.associateBy { it.pid }
    val verdicts = HashMap<Int, Verdict>()
    val out = ArrayList<Judged>(members.size)
    for (p in members.sortedWith(compareBy({ it.startedAt }, { it.pid }))) {
      val (verdict, why) = verdict(p, byPid, verdicts, firstInputAt, now, writers)
      verdicts[p.pid] = verdict
      out += Judged(p, verdict, why)
    }
    return out
  }

  private fun verdict(
    p: ProcDetail,
    byPid: Map<Int, ProcDetail>,
    verdicts: Map<Int, Verdict>,
    firstInputAt: Long?,
    now: Long,
    writers: Map<Long, Set<Int>>?,
  ): Pair<Verdict, String> {
    if (firstInputAt == null) return Verdict.OWN to "no input yet"
    if (p.startedAt < firstInputAt) return Verdict.OWN to "started before the first input"
    if (now - p.startedAt < WorkRules.MIN_AGE_MS) return Verdict.YOUNG to "younger than ${WorkRules.MIN_AGE_MS / 1000} s"
    if (isShell(p)) return Verdict.WORK to "a shell"
    val parent = byPid[p.ppid] ?: return Verdict.WORK to "its parent is gone (orphan or daemon)"
    val parentVerdict = verdicts[parent.pid]
    if (parentVerdict == Verdict.WORK) return Verdict.WORK to "started by a job"
    if (parentVerdict == Verdict.OWN && isShell(parent)) return Verdict.WORK to "a command of the agent's shell"
    val agentSide = { pid: Int -> verdicts[pid] == Verdict.OWN || verdicts[pid] == Verdict.HELPER }
    return when (p.stdin.kind) {
      Stdin.Kind.PIPE -> {
        val holders = writers?.let { w -> p.stdin.inode?.let { w[it] }.orEmpty() - p.pid }
        when {
          holders == null && agentSide(parent.pid) -> Verdict.HELPER to "stdin a pipe from its parent"
          holders == null -> Verdict.WORK to "stdin a pipe from a job"
          holders.any(agentSide) -> Verdict.HELPER to "stdin a pipe the agent writes"
          else -> Verdict.WORK to "stdin a pipe the agent does not write"
        }
      }
      Stdin.Kind.SOCKET ->
        if (agentSide(parent.pid)) Verdict.HELPER to "stdin a socket from the agent" else Verdict.WORK to "stdin a socket from a job"
      else -> Verdict.WORK to "stdin ${p.stdin.kind.name.lowercase()}"
    }
  }

  /**
   * The jobs to name, oldest first: work that is not a shell, not a proot
   * left tracing a job (it is the job's, named by its tracee) and not
   * started by another such job; the outermost shells when nothing else is.
   */
  fun jobs(judged: List<Judged>): List<ProcDetail> {
    val work = judged.filter { it.verdict == Verdict.WORK }.map { it.proc }
    val byPid = work.associateBy { it.pid }
    val tracers = judged.mapTo(HashSet()) { it.proc.tracerPid }
    fun roots(pick: (ProcDetail) -> Boolean) = work.filter { p ->
      pick(p) && generateSequence(byPid[p.ppid]) { byPid[it.ppid] }.none(pick)
    }
    val named = { p: ProcDetail -> p.pid !in tracers }
    return roots { named(it) && !isShell(it) }.ifEmpty { roots(named) }.ifEmpty { roots { true } }
  }

  /** Its command line's first word (a login shell's "-bash" too), or its name. */
  fun isShell(p: ProcDetail): Boolean = program(p) in WorkRules.SHELLS

  fun program(p: ProcDetail): String? =
    p.argv.firstOrNull()?.takeIf { it.isNotEmpty() }?.substringAfterLast('/')?.removePrefix("-") ?: p.name
}
