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
// and whatever a job starts are work, except our kit's scripts (a hook the
// agent's kind runs, waiting for a message) and what they run, which are
// the agent's helpers. Our own runtime is seen through: a
// native agent's command reaches the machine as our launcher (named like
// the command, "bash" too), then proot, then the program; parents are read
// past them, and they take the verdict of what they carry. In doubt it is
// work: a wrong "work" keeps an agent up (the notification names it, with
// Stop), a wrong "helper" kills a job. Pure.
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
   * from the parent counts as the agent's. [minAgeMs]: younger is YOUNG
   * (WorkRules.STARTING_AGE_MS finds jobs starting).
   */
  fun judge(
    members: List<ProcDetail>,
    firstInputAt: Long?,
    now: Long,
    writers: Map<Long, Set<Int>>?,
    minAgeMs: Long = WorkRules.MIN_AGE_MS,
  ): List<Judged> {
    val byPid = members.associateBy { it.pid }
    val verdicts = HashMap<Int, Verdict>()
    val whys = HashMap<Int, String>()
    val sorted = members.sortedWith(compareBy({ it.startedAt }, { it.pid }))
    // The programs first, oldest first, so a parent is judged before its
    // children; then our runtime's processes, by what runs under them.
    for (p in sorted.filterNot(::isRuntime)) {
      val (verdict, why) = verdict(p, byPid, verdicts, firstInputAt, now, writers, minAgeMs)
      verdicts[p.pid] = verdict
      whys[p.pid] = why
    }
    for (r in sorted.filter(::isRuntime)) {
      val (verdict, why) = runtimeVerdict(r, members, byPid, verdicts, firstInputAt, now, minAgeMs)
      verdicts[r.pid] = verdict
      whys[r.pid] = why
    }
    return sorted.map { Judged(it, verdicts.getValue(it.pid), whys.getValue(it.pid)) }
  }

  private fun verdict(
    p: ProcDetail,
    byPid: Map<Int, ProcDetail>,
    verdicts: Map<Int, Verdict>,
    firstInputAt: Long?,
    now: Long,
    writers: Map<Long, Set<Int>>?,
    minAgeMs: Long,
  ): Pair<Verdict, String> {
    early(p, firstInputAt, now, minAgeMs)?.let { return it }
    if (isKitScript(p)) return Verdict.HELPER to "our kit's script (a hook)"
    if (isShell(p)) return Verdict.WORK to "a shell"
    val parent = parentOf(p, byPid) ?: return Verdict.WORK to "its parent is gone (orphan or daemon)"
    val parentVerdict = verdicts[parent.pid]
    if (parentVerdict == Verdict.HELPER && isKitScript(parent)) return Verdict.HELPER to "run by our kit's script"
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

  // The start-time verdicts every process gets first; null: judge it further.
  private fun early(p: ProcDetail, firstInputAt: Long?, now: Long, minAgeMs: Long): Pair<Verdict, String>? = when {
    firstInputAt == null -> Verdict.OWN to "no input yet"
    p.startedAt < firstInputAt -> Verdict.OWN to "started before the first input"
    now - p.startedAt < minAgeMs -> Verdict.YOUNG to "younger than ${minAgeMs / 1000} s"
    else -> null
  }

  // Our launcher or proot: what it carries into the machine decides. A job
  // under it makes it the job's; helpers under it make it a helper; with
  // nothing under it (a proot whose guest just ended) it is not work.
  private fun runtimeVerdict(
    r: ProcDetail,
    members: List<ProcDetail>,
    byPid: Map<Int, ProcDetail>,
    verdicts: Map<Int, Verdict>,
    firstInputAt: Long?,
    now: Long,
    minAgeMs: Long,
  ): Pair<Verdict, String> {
    early(r, firstInputAt, now, minAgeMs)?.let { return it }
    val under = members.filter { !isRuntime(it) && carries(r, it, byPid) }.map { verdicts[it.pid] }
    return when {
      Verdict.WORK in under -> Verdict.WORK to "our runtime, carrying a job"
      Verdict.YOUNG in under -> Verdict.YOUNG to "our runtime, carrying a program younger than ${minAgeMs / 1000} s"
      under.isNotEmpty() -> Verdict.HELPER to "our runtime, carrying the agent's helper"
      else -> Verdict.HELPER to "our runtime, with nothing under it"
    }
  }

  // [p]'s parent seen through our runtime: the nearest ancestor that is a
  // program (the agent that asked the shim for it); null when the chain
  // leaves the agent (an orphan or daemon).
  private fun parentOf(p: ProcDetail, byPid: Map<Int, ProcDetail>): ProcDetail? {
    var q = byPid[p.ppid]
    while (q != null && isRuntime(q)) q = byPid[q.ppid]
    return q
  }

  // Whether [p] runs under runtime process [r]: [r] traces it, or [p]'s
  // parents up to the first program pass through [r].
  private fun carries(r: ProcDetail, p: ProcDetail, byPid: Map<Int, ProcDetail>): Boolean {
    if (p.tracerPid == r.pid) return true
    var q = byPid[p.ppid]
    while (q != null && isRuntime(q)) {
      if (q.pid == r.pid) return true
      q = byPid[q.ppid]
    }
    return false
  }

  /**
   * The jobs to name, oldest first: work that is not a shell, not our
   * runtime (the launcher, a proot left tracing a job: they are the job's,
   * named by what they carry) and not started by another such job; the
   * outermost shells when nothing else is.
   */
  fun jobs(judged: List<Judged>): List<ProcDetail> {
    val work = judged.filter { it.verdict == Verdict.WORK }.map { it.proc }
    val byPid = work.associateBy { it.pid }
    val tracers = judged.mapTo(HashSet()) { it.proc.tracerPid }
    fun roots(pick: (ProcDetail) -> Boolean) = work.filter { p ->
      pick(p) && generateSequence(byPid[p.ppid]) { byPid[it.ppid] }.none(pick)
    }
    val named = { p: ProcDetail -> p.pid !in tracers && !isRuntime(p) }
    return roots { named(it) && !isShell(it) }.ifEmpty { roots(named) }.ifEmpty { roots { true } }
  }

  /** One of our runtime's binaries (WorkRules.RUNTIME_EXES): the launcher behind the shims, or proot. */
  fun isRuntime(p: ProcDetail): Boolean = p.exe != null && p.exe in WorkRules.RUNTIME_EXES

  /** Its command line runs one of our kit's scripts (WorkRules.KIT_SCRIPT), as a shell's script or inside its -c. */
  fun isKitScript(p: ProcDetail): Boolean = p.argv.any { WorkRules.KIT_SCRIPT in it }

  /** Its command line's first word (a login shell's "-bash" too), or its name. */
  fun isShell(p: ProcDetail): Boolean = program(p) in WorkRules.SHELLS

  fun program(p: ProcDetail): String? =
    p.argv.firstOrNull()?.takeIf { it.isNotEmpty() }?.substringAfterLast('/')?.removePrefix("-") ?: p.name
}
