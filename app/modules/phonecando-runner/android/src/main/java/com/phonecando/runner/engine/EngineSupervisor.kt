package com.phonecando.runner.engine

import android.content.Context
import android.util.Log
import com.phonecando.runner.PathRedactor
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentKinds
import com.phonecando.runner.agents.AgentStore
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.bridge.BridgeHandle
import com.phonecando.runner.engine.proc.OsSignals
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.notify.ChatTracker
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

// Runs the engines of several agents at once, keyed by agent id (one per
// process, Engines.get). Start: take a seat (EnginePolicy: at most three,
// else stop the least recently used idle one, else too_many_running), clear
// out processes an earlier life of this agent left behind, read the image
// and seed its HOME (EngineLauncher.plan), open the shared bridge, take a
// port (PortAllocator) and spawn; the call returns once the process runs
// and its port is known. EngineWatch then reports ready, a 401 (relaunch on
// a fresh port), a boot timeout or a death; a dead engine is marked died
// and its handle dropped, so the next start launches it again (nothing
// restarts it by itself). Stop: SIGTERM the engine and every process tagged
// with its agent id, wait up to 3 s, SIGKILL the rest (ProcessReaper);
// stopping all does every agent within that one wait. The lock guards slot
// state only: seeding, spawning and waiting run outside it, and `gen`
// settles the races that leaves open. Blocking calls run off the main thread.
internal class EngineSupervisor(
  private val context: Context,
  private val store: AgentStore,
  private val listener: Engines.Listener,
  private val launcher: EngineLauncher = EngineLauncher(context),
  private val reaper: ProcessReaper = OsSignals.reaper(),
  private val ports: PortAllocator = PortAllocator(LoopbackPorts::isFree, LoopbackPorts::pickFree),
) {
  private val lock = ReentrantLock()
  private val settled = lock.newCondition()
  private val slots = ConcurrentHashMap<String, EngineSlot>()
  private var bridge: BridgeHandle? = null
  private val chats = ChatTracker { listener.onChats() }
  private val streams = EngineStreams(::touch, AgentAlerts(context, store), chats)

  // ---- reads (any thread) ------------------------------------------------

  fun status(agentId: String): EngineStatus = lock.withLock { slots[agentId]?.status() }
    ?: EngineStatus(agentId, EngineState.STOPPED, null, null, null)

  /** Every agent in the store, in store order. */
  fun statuses(): List<EngineStatus> = store.all().map { status(it.id) }

  /** The chats the running engines are busy with (the service notification). */
  fun chats(): List<ChatBoard.Chat> = chats.chats()

  /** The user has this agent's chat in front: its done and error chats go. */
  fun chatsSeen(agentId: String) = chats.seen(agentId)

  /** The chat on screen (by id, or a TUI's by title), left out of the notification; nulls for none. */
  fun setOpenChat(agentId: String?, sessionId: String?, title: String?) = chats.setOpen(agentId, sessionId, title)

  /** The port of a starting or ready engine whose process runs; null otherwise. */
  fun livePort(agentId: String): Int? = lock.withLock {
    val slot = slots[agentId] ?: return null
    val running = slot.state == EngineState.STARTING || slot.state == EngineState.READY
    if (running && slot.process?.isAlive == true) slot.port else null
  }

  fun anyLive(): Boolean = slots.values.any { it.state.live }

  /** An engine we run, or any process tagged with an agent (also from an earlier app process). */
  fun anyAlive(): Boolean = anyLive() || reaper.anyTagged(null)

  fun touch(agentId: String) {
    slots[agentId]?.lastUsedAt = System.currentTimeMillis()
  }

  // ---- start -------------------------------------------------------------

  /** The engine's port; throws EngineStartException. Blocks (seeding, a possible eviction). */
  fun start(agentId: String, requestedAt: Long): Int {
    val record = store.get(agentId) ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent")
    val kind = AgentKinds.get(record.kind)
      ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent kind ${record.kind}")
    val gen = when (val seat = takeSeat(agentId)) {
      is Seat.Running -> return seat.port
      is Seat.Taken -> seat.gen
    }
    var port: Int? = null
    try {
      // Processes of this agent now are leftovers (a dead engine's
      // children, an engine from an earlier app process): end them first.
      reaper.stop(emptyList(), setOf(agentId))
      val plan = launcher.plan(record, kind, requestedAt)
      val bridgeUrl = ensureBridge()?.url
      val alloc = ports.allocate(record.port?.toIntOrNull())
      port = alloc.port
      if (alloc.squatted) {
        TelemetryRecorder.portSquat()
        Log.w(TAG, "port ${record.port} taken, $agentId moves to ${alloc.port}")
      }
      val proc = launcher.spawn(plan, alloc.port, bridgeUrl)
      if (!adopt(agentId, gen, plan, proc, alloc.port)) {
        reaper.stop(listOf(proc), setOf(agentId))
        throw EngineStartException(EngineStartError.START_FAILED, "stopped while starting")
      }
      port = null // the slot owns it now
      savePort(agentId, alloc.port)
      Log.i(TAG, "engine $agentId started on ${alloc.port}")
      return alloc.port
    } catch (e: Exception) {
      port?.let(ports::release)
      val failure = e as? EngineStartException
        ?: EngineStartException(EngineStartError.START_FAILED, e.message ?: e.javaClass.simpleName)
      fail(agentId, gen, failure)
      throw failure
    }
  }

  private sealed class Seat {
    data class Running(val port: Int) : Seat()

    data class Taken(val gen: Int) : Seat()
  }

  // Already running: its port. Otherwise marks the slot starting once the
  // policy admits it, stopping an idle engine first when it says so.
  private fun takeSeat(agentId: String): Seat {
    while (true) {
      var evict: String? = null
      var started: Pair<Int, EngineStatus>? = null
      lock.withLock {
        val slot = slots.getOrPut(agentId) { EngineSlot(agentId) }
        awaitSettled(slot)
        val port = slot.port
        if ((slot.state == EngineState.STARTING || slot.state == EngineState.READY) && port != null) {
          slot.lastUsedAt = System.currentTimeMillis()
          return Seat.Running(port)
        }
        val seats = slots.values
          .filter { it !== slot && (it.state == EngineState.STARTING || it.state == EngineState.READY) }
          .map { EnginePolicy.Seat(it.agentId, it.lastUsedAt ?: 0L, it.state == EngineState.READY) }
        when (val decision = EnginePolicy.admit(seats, System.currentTimeMillis())) {
          EnginePolicy.Admission.Admit -> {
            slot.state = EngineState.STARTING
            slot.gen++
            slot.port = null
            slot.error = null
            slot.process = null
            slot.squatRelaunches = 0
            slot.lastUsedAt = System.currentTimeMillis()
            started = slot.gen to slot.status()
          }
          is EnginePolicy.Admission.Evict -> evict = decision.agentId
          EnginePolicy.Admission.Reject -> throw EngineStartException(
            EngineStartError.TOO_MANY_RUNNING,
            "${EnginePolicy.MAX_RUNNING} agents are running and none has been idle for a minute",
          )
        }
      }
      started?.let { (gen, status) ->
        emit(status)
        return Seat.Taken(gen)
      }
      evict?.let {
        Log.i(TAG, "stopping idle engine $it to make room for $agentId")
        stop(it)
      }
    }
  }

  // Waits (lock held, released while waiting) while another call is
  // stopping the engine or relaunching it on a fresh port.
  private fun awaitSettled(slot: EngineSlot) {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(SETTLE_WAIT_MS)
    while (slot.state == EngineState.STOPPING || (slot.state == EngineState.STARTING && slot.port == null)) {
      val left = deadline - System.nanoTime()
      if (left <= 0) throw EngineStartException(EngineStartError.START_FAILED, "the engine is busy stopping")
      settled.awaitNanos(left)
    }
  }

  // The launched process becomes the slot's, unless a stop came in between.
  private fun adopt(agentId: String, gen: Int, plan: LaunchPlan, proc: Process, port: Int): Boolean {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return false
      if (slot.gen != gen || slot.state != EngineState.STARTING) return false
      slot.process = proc
      slot.port = port
      slot.plan = plan
      slot.watch = watch(slot, proc, plan, port).also { it.start() }
      settled.signalAll()
      slot.status()
    }
    emit(status)
    return true
  }

  private fun watch(slot: EngineSlot, proc: Process, plan: LaunchPlan, port: Int) = EngineWatch(
    agentId = slot.agentId,
    process = proc,
    healthProbe = plan.kind.healthProbe(port.toString(), plan.record.password),
    logFile = plan.logFile,
    requestedAt = plan.requestedAt,
    secrets = { PathRedactor.agentSecrets(store.all()) },
    onHealthy = { onHealthy(slot.agentId, proc) },
    onSquatted = { onSquatted(slot.agentId, proc) },
    onBootTimeout = { onBootTimeout(slot.agentId, proc) },
    onUnexpectedExit = { code -> onDied(slot.agentId, proc, code) },
  )

  private fun fail(agentId: String, gen: Int, e: EngineStartException) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.gen != gen || slot.state != EngineState.STARTING) return
      slot.state = EngineState.FAILED
      slot.error = e.message
      slot.port = null
      slot.process = null
      settled.signalAll()
      slot.status()
    }
    Log.w(TAG, "engine $agentId failed to start: ${e.message}")
    emit(status)
    afterEngineGone()
  }

  // Lock-free (slots is concurrent, state volatile): bridge threads ask on
  // every request.
  private fun bridgeLive(agentId: String): Boolean =
    slots[agentId]?.state.let { it == EngineState.STARTING || it == EngineState.READY }

  private fun ensureBridge(): BridgeHandle? = lock.withLock {
    bridge ?: try {
      Bridge.open(context, LiveAgents(store, ::bridgeLive), ::touch)
    } catch (e: Exception) {
      Log.w(TAG, "agent bridge failed to open", e)
      null
    }.also { bridge = it }
  }

  private fun savePort(agentId: String, port: Int) {
    try {
      store.setPort(agentId, port.toString())
    } catch (e: Exception) {
      Log.w(TAG, "port not saved for $agentId", e)
    }
  }

  // ---- watch callbacks (watch threads) ----------------------------------

  private fun onHealthy(agentId: String, proc: Process) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.process !== proc || slot.state != EngineState.STARTING) return
      slot.state = EngineState.READY
      openStream(slot)
      slot.status()
    }
    emit(status)
  }

  // Another engine answered on our port, so ours never bound it: relaunch
  // on an OS-assigned port, a couple of times at most. While the port is
  // unknown the slot stays starting with no port, so a start waits for it.
  private fun onSquatted(agentId: String, proc: Process) {
    val plan: LaunchPlan
    val oldPort: Int
    val gen: Int
    val retry: Boolean
    lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.process !== proc || slot.state != EngineState.STARTING) return
      plan = slot.plan ?: return
      oldPort = slot.port ?: return
      gen = slot.gen
      retry = slot.squatRelaunches < MAX_SQUAT_RELAUNCHES
      slot.squatRelaunches++
      slot.process = null
      slot.watch = null
      slot.port = null
    }
    TelemetryRecorder.portSquat()
    Log.w(TAG, "port $oldPort answers for another engine, relaunching $agentId")
    reaper.stop(listOf(proc), setOf(agentId))
    ports.release(oldPort)
    if (!retry) {
      fail(agentId, gen, EngineStartException(EngineStartError.PORT_UNAVAILABLE, "another engine keeps answering on its port"))
      return
    }
    var port: Int? = null
    try {
      val alloc = ports.allocate(null, avoid = setOf(oldPort))
      port = alloc.port
      val next = launcher.spawn(plan, alloc.port, ensureBridge()?.url)
      if (!adopt(agentId, gen, plan, next, alloc.port)) {
        reaper.stop(listOf(next), setOf(agentId))
        return
      }
      port = null // the slot owns it now
      savePort(agentId, alloc.port)
    } catch (e: Exception) {
      fail(agentId, gen, e as? EngineStartException ?: EngineStartException(EngineStartError.START_FAILED, e.message ?: "relaunch failed"))
    } finally {
      port?.let(ports::release)
    }
  }

  private fun onBootTimeout(agentId: String, proc: Process) {
    if (lock.withLock { slots[agentId]?.process !== proc }) return
    terminate(setOf(agentId), EngineState.FAILED, "not ready after ${EngineWatch.BOOT_TIMEOUT_MS / 1000} s")
  }

  private fun onDied(agentId: String, proc: Process, code: Int) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      // A stop that is under way settles the slot itself.
      if (slot.process !== proc || slot.state == EngineState.STOPPING) return
      slot.watch = null
      slot.sse?.stop()
      slot.sse = null
      slot.process = null
      slot.port?.let(ports::release)
      slot.port = null
      slot.state = EngineState.DIED
      slot.error = "exited with code $code"
      settled.signalAll()
      slot.status()
    }
    chats.detach(agentId)
    emit(status)
    afterEngineGone()
  }

  // ---- stop --------------------------------------------------------------

  /** Blocks up to ~3 s. Also ends leftovers tagged with this agent when nothing runs. */
  fun stop(agentId: String) = terminate(setOf(agentId), EngineState.STOPPED, null)

  /** Every engine and every tagged process, within one grace period. Blocks up to ~3 s. */
  fun stopAll() = terminate(null, EngineState.STOPPED, null)

  /** stopAll on its own thread, for the service's main-thread callbacks. */
  fun stopAllAsync() {
    Thread({ stopAll() }, "phonecando-engine-stop-all").apply {
      isDaemon = true
      start()
    }
  }

  /** Drops a deleted agent's slot; stop it first. */
  fun forget(agentId: String) {
    lock.withLock {
      val slot = slots[agentId] ?: return
      if (!slot.state.live) slots.remove(agentId)
    }
  }

  // agentIds null: all agents, and processes tagged with any agent id.
  private fun terminate(agentIds: Set<String>?, final: EngineState, error: String?) {
    val engines = ArrayList<Process>()
    val ending = ArrayList<Pair<EngineSlot, Int>>()
    val others = ArrayList<EngineSlot>()
    val stopping = ArrayList<EngineStatus>()
    lock.withLock {
      val targets = if (agentIds == null) slots.values.toList() else agentIds.mapNotNull { slots[it] }
      for (slot in targets) {
        when (slot.state) {
          EngineState.STOPPING -> others += slot
          EngineState.STARTING, EngineState.READY -> {
            slot.state = EngineState.STOPPING
            slot.gen++
            // Before the signals: the exit that follows was asked for.
            slot.watch?.markStopping()
            slot.watch = null
            slot.sse?.stop()
            slot.sse = null
            slot.process?.let(engines::add)
            ending += slot to slot.gen
            stopping += slot.status()
          }
          else -> {}
        }
      }
    }
    stopping.forEach(::emit)
    ending.forEach { (slot, _) -> chats.detach(slot.agentId) }
    reaper.stop(engines, agentIds)
    val ended = ArrayList<EngineStatus>()
    lock.withLock {
      for ((slot, gen) in ending) {
        if (slot.gen != gen || slot.state != EngineState.STOPPING) continue
        slot.process = null
        slot.port?.let(ports::release)
        slot.port = null
        slot.state = final
        slot.error = error
        ended += slot.status()
      }
      settled.signalAll()
      // Another call is stopping these; return once it is done.
      for (slot in others) {
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(SETTLE_WAIT_MS)
        while (slot.state == EngineState.STOPPING && System.nanoTime() < deadline) {
          settled.awaitNanos(deadline - System.nanoTime())
        }
      }
    }
    ended.forEach(::emit)
    afterEngineGone()
  }

  // The last engine is gone: close the bridge and tell the service.
  private fun afterEngineGone() {
    var closing: BridgeHandle? = null
    val idle = lock.withLock {
      val none = slots.values.none { it.state.live }
      if (none) {
        closing = bridge
        bridge = null
      }
      none
    }
    try {
      closing?.stop()
    } catch (e: Exception) {
      Log.w(TAG, "agent bridge stop failed", e)
    }
    if (idle) listener.onIdle()
  }

  // ---- event streams ---------------------------------------------------------

  private fun openStream(slot: EngineSlot) {
    if (slot.sse != null) return
    val plan = slot.plan ?: return
    val port = slot.port ?: return
    slot.sse = try {
      streams.open(slot.agentId, plan.kind, port, plan.record.password)
    } catch (e: Exception) {
      Log.w(TAG, "event stream start failed", e)
      null
    }
  }

  private fun emit(status: EngineStatus) {
    try {
      listener.onStatus(status)
    } catch (e: Exception) {
      Log.w(TAG, "engine status listener failed", e)
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoEngines"
    const val MAX_SQUAT_RELAUNCHES = 2
    // Longest a start or stop waits for another call on the same engine.
    const val SETTLE_WAIT_MS = ProcessReaper.GRACE_MS + 3_000L
  }
}
