package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
import kotlin.concurrent.withLock

// Watches what the running agents left running, and stops an idle agent
// with nothing left once the app is in the background. While an engine
// runs it looks every POLL_MS (and at once on poke: an engine starting):
// reads our processes, judges each agent's (AgentWork), measures whether
// its jobs are doing something (WorkMeter), and, with the app in the
// background, stops the agents ReclaimPolicy picks (Host.stop, as a user
// stop: the agent and all it started). It tells [onLook] after every look,
// whether anything changed, so the service can update its notification
// and keep the CPU awake (power/WorkLock). The JS asks busyNow before
// stopping an agent itself. One thread at a time, which ends once no
// engine runs. Each process's verdict is logged once decided and when it
// changes ([phonecando-work]), so a wrong one can be read off logcat.
internal class WorkWatch(
  private val host: Host,
  /** Our processes now (DetailScanner.scan). */
  private val scan: () -> List<ProcDetail>,
  /** DetailScanner.pipeWriters. */
  private val writers: (Collection<Int>, Set<Long>) -> Map<Long, Set<Int>>?,
  private val onLook: (changed: Boolean) -> Unit,
  private val log: (String) -> Unit = {},
  private val clock: () -> Long = System::currentTimeMillis,
  /** A look that failed; the watch looks again after POLL_MS. */
  private val onError: (Exception) -> Unit = {},
) {
  /** What the watch sees of the engines and the app. */
  interface Host {
    /** Engines starting or ready. */
    fun agents(): List<Agent>

    /** An activity of ours is on screen. */
    fun foreground(): Boolean

    /** An agent drives the screen now or did in the last 30 s (the bridge's screen lease). */
    fun screenInUse(): Boolean

    /** Stops the agent and all it started, as a user stop. Blocks. */
    fun stop(agentId: String)
  }

  /**
   * [idle]: by its kind's rule, never with a chat working; [firstInputAt]:
   * epoch ms of the user's first input in this engine life (null: none
   * yet); [kept]: the user keeps it running.
   */
  data class Agent(
    val agentId: String,
    val ready: Boolean,
    val idle: Boolean,
    val quietMs: Long,
    val firstInputAt: Long?,
    val kept: Boolean,
  )

  /** One agent at the last look: its [jobs] by name (WorkNames), whether they are doing something ([active]). */
  data class State(val agentId: String, val jobs: List<String>, val active: Boolean, val kept: Boolean) {
    val busy: Boolean get() = jobs.isNotEmpty()
  }

  private val lock = ReentrantLock()
  private val wake = lock.newCondition()
  private var running = false
  private var woken = false

  @Volatile private var states: Map<String, State> = emptyMap()

  // The watch thread's own.
  private val meter = WorkMeter()
  private val lastBusyAt = HashMap<String, Long>()
  private val logged = HashMap<String, Set<Pair<Int, AgentWork.Verdict>>>()
  private var awaySince: Long? = null

  /** Each live agent at the last look. Any thread. */
  fun states(): Map<String, State> = states

  /**
   * Whether the agent has a job running or is kept running, from a fresh
   * look at its processes (the last look may be POLL_MS old). Any thread.
   */
  fun busyNow(agentId: String): Boolean {
    val agent = host.agents().firstOrNull { it.agentId == agentId } ?: return false
    if (agent.kept) return true
    return work(agent, scan(), clock()).any { it.verdict == AgentWork.Verdict.WORK }
  }

  /** Looks at once, starting the watch's thread when none runs. */
  fun poke() {
    lock.withLock {
      woken = true
      wake.signalAll()
      if (running) return
      running = true
    }
    thread(name = "phonecando-work-watch", isDaemon = true) { loop() }
  }

  private fun loop() {
    try {
      while (true) {
        lock.withLock { woken = false }
        val delay = try {
          tick()
        } catch (e: Exception) {
          onError(e)
          WorkRules.POLL_MS
        }
        lock.withLock {
          if (delay == null) {
            // A poke while this look found nothing: look again.
            if (!woken) {
              running = false
              return
            }
          } else if (!woken) {
            wake.await(delay, TimeUnit.MILLISECONDS)
          }
        }
      }
    } catch (_: InterruptedException) {
      // Daemon thread: ends with the process.
      lock.withLock { running = false }
    }
  }

  /** One look; the time until the next, or null once no engine runs (the thread ends). */
  fun tick(): Long? {
    val now = clock()
    val agents = host.agents()
    if (agents.isEmpty()) {
      val changed = states.isNotEmpty()
      states = emptyMap()
      lastBusyAt.clear()
      logged.clear()
      awaySince = null
      onLook(changed)
      return null
    }
    val all = scan()
    val judged = agents.associate { it.agentId to work(it, all, now) }
    val jobs = judged.mapValues { (_, list) -> list.filter { it.verdict == AgentWork.Verdict.WORK }.map { it.proc } }
    val active = meter.look(all, jobs, now)
    lastBusyAt.keys.retainAll(judged.keys)
    logged.keys.retainAll(judged.keys)
    val next = agents.associate { a ->
      val named = AgentWork.jobs(judged.getValue(a.agentId)).map(WorkNames::of).distinct()
      if (named.isNotEmpty()) lastBusyAt[a.agentId] = now
      a.agentId to State(a.agentId, named, a.agentId in active && named.isNotEmpty(), a.kept)
    }
    for ((agentId, list) in judged) logIfChanged(agentId, list)
    val changed = next != states
    states = next
    val foreground = host.foreground()
    awaySince = if (foreground) null else awaySince ?: now
    onLook(changed)
    if (!foreground) {
      val candidates = agents.map { a ->
        ReclaimPolicy.Agent(a.agentId, a.ready, a.idle, next.getValue(a.agentId).busy, a.kept, a.quietMs, lastBusyAt[a.agentId])
      }
      for (agentId in ReclaimPolicy.toStop(candidates, awaySince, host.screenInUse(), now)) {
        // The user came back meanwhile: the app restarts its agent, and a
        // stop now would race that start.
        if (host.foreground()) break
        log("[phonecando-work] $agentId is idle with no job left and the app is away: stopping it")
        host.stop(agentId)
      }
    }
    return WorkRules.POLL_MS
  }

  private fun work(agent: Agent, all: List<ProcDetail>, now: Long): List<AgentWork.Judged> {
    val members = AgentWork.members(all, agent.agentId)
    val pipes = AgentWork.pipesToCheck(members, agent.firstInputAt)
    val pipeWriters = if (pipes.isEmpty()) emptyMap() else writers(members.map { it.pid }, pipes)
    return AgentWork.judge(members, agent.firstInputAt, now, pipeWriters)
  }

  // Each process's verdict once it has one (not YOUNG) and whenever it
  // changes, so a job that spawns a `sleep 1` a second logs nothing new.
  private fun logIfChanged(agentId: String, judged: List<AgentWork.Judged>) {
    val seen = logged[agentId].orEmpty()
    val decided = judged.filter { it.verdict != AgentWork.Verdict.YOUNG }
    for (j in decided) {
      if (j.proc.pid to j.verdict in seen) continue
      log("[phonecando-work] $agentId ${j.proc.pid} ${j.verdict} ${WorkNames.of(j.proc)} (${j.why})")
    }
    logged[agentId] = decided.mapTo(HashSet()) { it.proc.pid to it.verdict }
  }
}
