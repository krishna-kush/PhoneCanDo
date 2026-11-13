package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
import kotlin.concurrent.withLock

// Watches what the running agents left running, and stops an idle agent
// with nothing left once the app is in the background. While an engine
// runs it looks every POLL_MS (and at once on poke: an engine starting, a
// run ending, the app leaving the screen; sooner while a job is starting,
// WorkRules.STARTING_AGE_MS): reads our processes, judges each agent's
// (AgentWork), measures whether its jobs are doing something (WorkMeter),
// tells an agent whose kind raises no chat events while it is not idle by
// its kind's rule (it may be at work, unseen), and, with the app in the
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
   * yet); [kept]: the user keeps it running; [ask]: its own live ask to
   * stay up (KeepAsks); [running]: a chat of its is working (what it
   * starts then is the run's own); [reportsChats]: its kind raises chat
   * events, so the notification sees its runs.
   */
  data class Agent(
    val agentId: String,
    val ready: Boolean,
    val idle: Boolean,
    val quietMs: Long,
    val firstInputAt: Long?,
    val kept: Boolean,
    val ask: KeepAsks.Ask? = null,
    val running: Boolean = false,
    val reportsChats: Boolean = true,
  ) {
    /** Never stopped for being idle: the user keeps it running or it asked to stay up. */
    val held: Boolean get() = kept || ask != null
  }

  /**
   * One agent at the last look: its [jobs] by name (WorkNames), whether
   * they are doing something ([active]), Keep running ([kept]), its own
   * ask to stay up ([ask]), the jobs it is [starting] (WorkRules.
   * STARTING_AGE_MS), and [printing]: its kind raises no chat events and
   * it is not idle by its kind's rule, so it may be at work.
   */
  data class State(
    val agentId: String,
    val jobs: List<String>,
    val active: Boolean,
    val kept: Boolean,
    val ask: KeepAsks.Ask? = null,
    val starting: List<String> = emptyList(),
    val printing: Boolean = false,
  ) {
    val busy: Boolean get() = jobs.isNotEmpty()

    val held: Boolean get() = kept || ask != null
  }

  private val lock = ReentrantLock()
  private val wake = lock.newCondition()
  private var running = false
  private var woken = false

  @Volatile private var states: Map<String, State> = emptyMap()

  // Epoch ms until which a process younger than STARTING_AGE_MS brings the
  // next look that close (poke).
  @Volatile private var quickUntil = 0L

  // The watch thread's own.
  private val meter = WorkMeter()
  private val lastBusyAt = HashMap<String, Long>()
  private val logged = HashMap<String, Set<Pair<Int, AgentWork.Verdict>>>()
  private var awaySince: Long? = null

  /** Each live agent at the last look. Any thread. */
  fun states(): Map<String, State> = states

  /**
   * Whether the agent has a job running, is kept running or asked to stay
   * up, from a fresh look at its processes (the last look may be POLL_MS
   * old). Any thread.
   */
  fun busyNow(agentId: String): Boolean {
    val agent = host.agents().firstOrNull { it.agentId == agentId } ?: return false
    if (agent.held) return true
    return work(agent, scan(), clock()).any { it.verdict == AgentWork.Verdict.WORK }
  }

  /**
   * Looks at once, starting the watch's thread when none runs; for
   * MIN_AGE_MS after, a job that may be starting is looked at again soon
   * (WorkRules.STARTING_AGE_MS).
   */
  fun poke() {
    quickUntil = clock() + WorkRules.MIN_AGE_MS
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
    val looked = agents.associate { it.agentId to members(it, all) }
    val judged = agents.associate { a -> a.agentId to looked.getValue(a.agentId).judge(a, now) }
    val starting = agents.associate { a ->
      a.agentId to starting(a, looked.getValue(a.agentId), judged.getValue(a.agentId), now)
    }
    val jobs = judged.mapValues { (_, list) -> list.filter { it.verdict == AgentWork.Verdict.WORK }.map { it.proc } }
    val active = meter.look(all, jobs, now)
    lastBusyAt.keys.retainAll(judged.keys)
    logged.keys.retainAll(judged.keys)
    val next = agents.associate { a ->
      val named = AgentWork.jobs(judged.getValue(a.agentId)).map(WorkNames::of).distinct()
      if (named.isNotEmpty()) lastBusyAt[a.agentId] = now
      val coming = starting.getValue(a.agentId).jobs.map(WorkNames::of).distinct()
      val printing = !a.reportsChats && !a.idle
      a.agentId to State(a.agentId, named, a.agentId in active && named.isNotEmpty(), a.kept, a.ask, coming, printing)
    }
    for ((agentId, list) in judged) logIfChanged(agentId, list)
    val changed = next != states
    states = next
    val foreground = host.foreground()
    awaySince = if (foreground) null else awaySince ?: now
    onLook(changed)
    if (!foreground) {
      val candidates = agents.map { a ->
        ReclaimPolicy.Agent(a.agentId, a.ready, a.idle, next.getValue(a.agentId).busy, a.held, a.quietMs, lastBusyAt[a.agentId])
      }
      for (agentId in ReclaimPolicy.toStop(candidates, awaySince, host.screenInUse(), now)) {
        // The user came back meanwhile: the app restarts its agent, and a
        // stop now would race that start.
        if (host.foreground()) break
        log("[phonecando-work] $agentId is idle with no job left and the app is away: stopping it")
        host.stop(agentId)
      }
    }
    return nextLook(starting.values, now)
  }

  // An agent's processes, and who writes the stdin pipes of those that may be helpers.
  private class Members(val procs: List<ProcDetail>, val writers: Map<Long, Set<Int>>?) {
    fun judge(agent: Agent, now: Long, minAgeMs: Long = WorkRules.MIN_AGE_MS): List<AgentWork.Judged> =
      AgentWork.judge(procs, agent.firstInputAt, now, writers, minAgeMs)
  }

  // [jobs]: what an agent with no run going is starting (WorkRules.
  // STARTING_AGE_MS); [fresh]: something of its is younger still.
  private class Starting(val jobs: List<ProcDetail>, val fresh: Boolean)

  private fun members(agent: Agent, all: List<ProcDetail>): Members {
    val members = AgentWork.members(all, agent.agentId)
    val pipes = AgentWork.pipesToCheck(members, agent.firstInputAt)
    return Members(members, if (pipes.isEmpty()) emptyMap() else writers(members.map { it.pid }, pipes))
  }

  private fun work(agent: Agent, all: List<ProcDetail>, now: Long): List<AgentWork.Judged> = members(agent, all).judge(agent, now)

  // The jobs past STARTING_AGE_MS that MIN_AGE_MS has not decided yet but
  // every other rule calls work. None while a run goes: what it starts is
  // its own until it ends.
  private fun starting(agent: Agent, members: Members, judged: List<AgentWork.Judged>, now: Long): Starting {
    val young = judged.filter { it.verdict == AgentWork.Verdict.YOUNG }.mapTo(HashSet()) { it.proc.pid }
    if (agent.running || young.isEmpty()) return NONE_STARTING
    val early = members.judge(agent, now, WorkRules.STARTING_AGE_MS)
    return Starting(AgentWork.jobs(early).filter { it.pid in young }, early.any { it.verdict == AgentWork.Verdict.YOUNG })
  }

  // POLL_MS; sooner while jobs are starting (when the first is decided)
  // and, for a while after a poke, while something is younger still.
  private fun nextLook(starting: Collection<Starting>, now: Long): Long {
    var delay = WorkRules.POLL_MS
    starting.flatMap { it.jobs }.minOfOrNull { it.startedAt + WorkRules.MIN_AGE_MS - now }?.let {
      delay = minOf(delay, it.coerceAtLeast(0L) + DECIDE_SLACK_MS)
    }
    if (now < quickUntil && starting.any { it.fresh }) delay = minOf(delay, WorkRules.STARTING_AGE_MS)
    return delay
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

  private companion object {
    val NONE_STARTING = Starting(emptyList(), fresh = false)

    // A look meant for when a job is decided comes this much after.
    const val DECIDE_SLACK_MS = 100L
  }
}
