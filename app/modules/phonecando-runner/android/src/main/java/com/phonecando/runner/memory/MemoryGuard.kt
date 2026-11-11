package com.phonecando.runner.memory

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
import kotlin.concurrent.withLock

// Keeps the phone from running out of memory under our agents. While an
// engine or a model server runs it looks every POLL_MS (and at once on
// poke: an engine starting, Android's memory callbacks): reads the phone's
// memory, asks MemoryPolicy for the level and the countdown, and when that
// runs out stops the agent MemoryPolicy.victim picks (Host.stop, as a user
// stop, so its model server goes with its last holder). One agent per stop.
// Each process's bytes are read only while the level is not ok, or when the
// app asks (status). It tells [onChange] on every level or countdown change,
// after a stop and on every look while not ok. With the app in the
// background it posts one warning per episode, and after each stop one
// notice naming what was stopped (Alerts). One thread at a time, which ends
// once nothing of ours runs.
internal class MemoryGuard(
  private val host: Host,
  private val system: () -> MemoryReading?,
  /** Bytes per agent and per model (ProcessMemory). */
  private val owners: () -> ProcessMemory.Owners,
  private val alerts: Alerts,
  private val onChange: (MemoryStatus) -> Unit,
  private val clock: () -> Long = System::currentTimeMillis,
  /** A look that failed; the guard looks again after POLL_MS. */
  private val onError: (Exception) -> Unit = {},
) {
  /** What the guard sees of our engines and model servers. */
  interface Host {
    /** Engines starting or ready (bytes unread). */
    fun agents(): List<MemoryAgent>

    /** Model servers loading or ready (bytes unread). */
    fun models(): List<MemoryModel>

    /** The agent on screen (setOpenChat); null for none. */
    fun openAgent(): String?

    /** An activity of ours is on screen. */
    fun foreground(): Boolean

    /** An engine starting, ready or stopping, or a model server up. */
    fun anyRunning(): Boolean

    /** Stops the agent as a user stop would, saying why on its status. Blocks. */
    fun stop(agentId: String)

    fun name(agentId: String): String?
  }

  /** The notifications, posted only while the app is in the background. */
  interface Alerts {
    /** Memory is short; [stopInMs] until we stop one, null with no countdown. */
    fun warn(stopInMs: Long?)

    /** What we stopped in this episode so far, by name. */
    fun stopped(names: List<String>)

    /** The episode ended with nothing stopped: the warning goes. */
    fun clear()
  }

  private val lock = ReentrantLock()
  private val wake = lock.newCondition()
  private var running = false
  private var woken = false

  @Volatile private var state = MemoryPolicy.State()
  @Volatile private var lastAutoStop: AutoStop? = null

  // The guard thread's own.
  private var told: Told? = null
  private var warned = false
  private val stopped = ArrayList<String>()

  private data class Told(val level: MemoryLevel, val stopAt: Long?, val next: String?)

  /** Looks at once, starting the guard's thread when none runs. */
  fun poke() {
    lock.withLock {
      woken = true
      wake.signalAll()
      if (running) return
      running = true
    }
    thread(name = "phonecando-memory-guard", isDaemon = true) { loop() }
  }

  /** The reading now, with every process's bytes (memoryStatus). Any thread. */
  fun status(): MemoryStatus {
    val reading = system()
    val s = state
    val level = reading?.let { MemoryPolicy.level(it, s.level) } ?: s.level
    return build(reading, level, s, host.agents(), host.models(), readBytes = true)
  }

  private fun loop() {
    try {
      while (true) {
        lock.withLock { woken = false }
        val delay = try {
          tick()
        } catch (e: Exception) {
          onError(e)
          MemoryRules.POLL_MS
        }
        lock.withLock {
          if (delay == null) {
            // A poke while this look found nothing: look again.
            if (!woken) {
              running = false
              return
            }
          } else if (!woken && delay > 0) {
            wake.await(delay, TimeUnit.MILLISECONDS)
          }
        }
      }
    } catch (_: InterruptedException) {
      // Daemon thread: ends with the process.
      lock.withLock { running = false }
    }
  }

  /** One look; the time until the next, or null once nothing of ours runs (the thread ends). */
  fun tick(): Long? {
    val now = clock()
    if (!host.anyRunning()) {
      // Nothing of ours to stop: a warning goes, and a new run warns again.
      endEpisode()
      val idle = MemoryPolicy.idle(state)
      if (idle != state) {
        state = idle
        tell(build(system(), idle.level, idle, emptyList(), emptyList(), readBytes = false))
      }
      return null
    }
    val reading = system() ?: return MemoryRules.POLL_MS
    val level = MemoryPolicy.level(reading, state.level)
    if (level == MemoryLevel.OK && state.level == MemoryLevel.OK) {
      // The usual case: a cheap look, told only when it changes.
      endEpisode()
      tellIfChanged(reading, level, state)
      return MemoryRules.POLL_MS
    }
    val agents = host.agents()
    val foreground = host.foreground()
    val keep = if (foreground) host.openAgent() else null
    val victim = MemoryPolicy.victim(agents.map { MemoryPolicy.Candidate(it.agentId, it.working, it.lastUsedAt) }, keep)
    val step = MemoryPolicy.step(state, level, victim != null, now)
    state = step.state
    if (step.stop && victim != null) {
      autoStop(victim, foreground)
      // Look again at once: the next look tells what was stopped.
      return 0L
    }
    if (level == MemoryLevel.OK) {
      endEpisode()
      tellIfChanged(reading, level, state)
      return MemoryRules.POLL_MS
    }
    if (!warned && !foreground) {
      alerts.warn(state.stopAt?.let { it - now })
      warned = true
    }
    // Not ok: told on every look, with each process's bytes.
    tell(build(reading, level, state, agents, host.models(), readBytes = true, victim = victim))
    val next = listOfNotNull(state.stopAt, state.settleUntil).minOrNull() ?: return MemoryRules.POLL_MS
    return (next - now).coerceIn(1L, MemoryRules.POLL_MS)
  }

  private fun autoStop(agentId: String, foreground: Boolean) {
    val before = host.models().map { it.modelId }.toSet()
    host.stop(agentId)
    val gone = before - host.models().map { it.modelId }.toSet()
    lastAutoStop = AutoStop(clock(), listOf(agentId), gone.sorted())
    stopped += agentId
    // The next look tells, whatever it finds.
    told = null
    if (!foreground) alerts.stopped(stopped.map { host.name(it) ?: "an agent" })
  }

  // Back to ok: a warning nothing came of goes, and the next episode warns again.
  private fun endEpisode() {
    if (warned && stopped.isEmpty()) alerts.clear()
    warned = false
    stopped.clear()
  }

  private fun tellIfChanged(reading: MemoryReading, level: MemoryLevel, s: MemoryPolicy.State) {
    if (told == Told(level, s.stopAt, null)) return
    tell(build(reading, level, s, host.agents(), host.models(), readBytes = false))
  }

  private fun tell(status: MemoryStatus) {
    told = Told(status.level, status.stopAt, status.nextStopAgentId)
    onChange(status)
  }

  private fun build(
    reading: MemoryReading?,
    level: MemoryLevel,
    s: MemoryPolicy.State,
    agents: List<MemoryAgent>,
    models: List<MemoryModel>,
    readBytes: Boolean,
    victim: String? = null,
  ): MemoryStatus {
    val bytes = if (readBytes && (agents.isNotEmpty() || models.isNotEmpty())) runCatching(owners).getOrNull() else null
    val stopAt = s.stopAt
    val next = when {
      stopAt == null -> null
      victim != null -> victim
      else -> MemoryPolicy.victim(
        agents.map { MemoryPolicy.Candidate(it.agentId, it.working, it.lastUsedAt) },
        if (host.foreground()) host.openAgent() else null,
      )
    }
    return MemoryStatus(
      level = level,
      totalBytes = reading?.totalBytes ?: 0L,
      availBytes = reading?.availBytes ?: 0L,
      warnBelowBytes = reading?.let { MemoryPolicy.lines(it).warnBelow } ?: 0L,
      stopAt = stopAt,
      nextStopAgentId = next,
      agents = agents.map { it.copy(bytes = bytes?.agents?.get(it.agentId)) },
      models = models.map { it.copy(bytes = bytes?.models?.get(it.modelId)) },
      lastAutoStop = lastAutoStop,
    )
  }
}
