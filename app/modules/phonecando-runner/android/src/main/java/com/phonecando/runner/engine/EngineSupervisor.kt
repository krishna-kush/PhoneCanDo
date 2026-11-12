package com.phonecando.runner.engine

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.PathRedactor
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentStore
import com.phonecando.runner.agents.install.InstallGate
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.bridge.BridgeHandle
import com.phonecando.runner.engine.events.KitFiles
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.proc.OsSignals
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.engine.ready.HttpReady
import com.phonecando.runner.engine.ready.TuiReady
import com.phonecando.runner.engine.spawn.TuiProcess
import com.phonecando.runner.engine.tui.TerminalViewException
import com.phonecando.runner.engine.tui.TerminalViewers
import com.phonecando.runner.limits.RunLimits
import com.phonecando.runner.memory.MemoryRules
import com.phonecando.runner.models.ModelServer
import com.phonecando.runner.models.ModelServerKeys
import com.phonecando.runner.models.ModelSlots
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.models.prompt.PromptWatch
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.notify.ChatTracker
import com.phonecando.runner.prompts.OpenUrlPrompts
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

// Runs the engines of several agents at once, keyed by agent id (one per
// process, Engines.get). Start: refuse an agent whose kind installs into
// its image while that install is not recorded (InstallGate), take a seat
// (EnginePolicy: no cap unless the user set one, RunLimits; at the cap stop
// the least recently used idle one, else too_many_running; the memory
// guard, memory/, looks after RAM), clear out processes an earlier life of
// this agent left behind, read the image and seed its HOME
// (EngineLauncher.plan), bring up its local model's server when it has one
// (LocalModelBinding: this waits while the model loads; an agent whose
// model cannot serve it is refused model_unavailable, one past the user's
// cap on loaded models too_many_models), open the shared bridge when its
// kind has phone tools (BridgeAccess), take a port (PortAllocator; a
// server engine only) and spawn by the kind's engine style; the call
// returns once the process runs (and a server's port is known). Whenever
// an engine is gone (stop, failed start, death) its hold on its model ends,
// and the last one stops that model's server; a model server that dies
// takes its agents down (died, model_unavailable); while one is busy for an
// agent with a run going, its prompt reading is watched (models/prompt/).
// stopModel stops a model's agents, then its server. EngineWatch then reports ready (the kind's
// ReadyProbe), a 401 (relaunch on a fresh port), a boot timeout or an
// exit; an engine that dies is marked died and its handle dropped, so
// the next start launches it again (nothing restarts it by itself); a TUI
// that exits 0 just stopped.
// A TUI engine's terminal stays with its slot while it runs; viewers attach
// to it through `terminals`. Stop: ask the engine to end (SIGTERM, or a
// TUI's hang-up) and SIGTERM every process tagged with its agent id, wait
// up to 3 s, SIGKILL the rest (ProcessReaper); stopping all does every
// agent within that one wait. The lock guards slot state only: seeding,
// spawning and waiting run outside it, and `gen` settles the races that
// leaves open. Blocking calls run off the main thread.
internal class EngineSupervisor(
  private val context: Context,
  private val store: AgentStore,
  private val listener: Engines.Listener,
  private val launcher: EngineLauncher = EngineLauncher(context),
  private val reaper: ProcessReaper = OsSignals.reaper(),
  private val ports: PortAllocator = PortAllocator(LoopbackPorts::isFree, LoopbackPorts::pickFree),
  /** The user's caps (RunLimitStore), read at each start. */
  private val limits: () -> RunLimits = { RunLimits.NONE },
) {
  private val lock = ReentrantLock()
  private val settled = lock.newCondition()
  private val slots = ConcurrentHashMap<String, EngineSlot>()
  private var bridge: BridgeHandle? = null
  private val chats: ChatTracker = ChatTracker {
    listener.onChats()
    // A run may have started or ended.
    prompts.poke()
  }
  private val models = ModelSlots.binding(context, ports, reaper, { limits().maxModels }, ::onModelDied)
  private val prompts: PromptWatch = ModelSlots.promptWatch(context, models, chats::working) { listener.onPrompt(it) }
  private val streams = EngineStreams(
    onActivity = ::onActivity,
    alerts = AgentAlerts(context, store),
    chats = chats,
    openUrl = { agentId, url -> OpenUrlPrompts.raise(context, store, agentId, url) },
    dropUrls = { agentId -> OpenUrlPrompts.end(context, agentId) },
  )

  /** The viewers of the TUI engines' terminals (the engineTerminal* functions). */
  val terminals = TerminalViewers()

  // The agent whose chat or TUI is on screen (setOpenChat); the memory
  // guard never stops it while the app is in front.
  @Volatile private var openAgent: String? = null

  // ---- reads (any thread) ------------------------------------------------

  fun status(agentId: String): EngineStatus = lock.withLock { slots[agentId]?.status() }
    ?: EngineStatus(agentId, EngineState.STOPPED, null, null, null)

  /** Every agent in the store, in store order. */
  fun statuses(): List<EngineStatus> = store.all().map { status(it.id) }

  /** The chats the running engines are busy with (the service notification). */
  fun chats(): List<ChatBoard.Chat> = chats.chats()

  /** A model server reading a prompt for a bound agent's run; null when not (or not watched). */
  fun promptReading(): PromptReading? = prompts.current()

  /** The user has this agent's chat in front: its done and error chats go. */
  fun chatsSeen(agentId: String) = chats.seen(agentId)

  /** The chat on screen (by id, or a TUI's by title), left out of the notification; nulls for none. */
  fun setOpenChat(agentId: String?, sessionId: String?, title: String?) {
    openAgent = agentId
    chats.setOpen(agentId, sessionId, title)
  }

  /** The agent the app has on screen (setOpenChat); null when none or the app is not in front. */
  fun openAgent(): String? = openAgent

  /** The local model servers loading or ready, and the agents holding each. */
  fun loadedModels(): List<ModelServer.Loaded> = models.loaded()

  /** The port of a starting or ready server engine whose process runs; null otherwise. */
  fun livePort(agentId: String): Int? = lock.withLock {
    slots[agentId]?.takeIf(::running)?.port
  }

  /** Whether the agent's engine is starting or ready and its process runs, whatever its style. */
  fun isLive(agentId: String): Boolean = lock.withLock { slots[agentId]?.let(::running) == true }

  private fun running(slot: EngineSlot): Boolean =
    (slot.state == EngineState.STARTING || slot.state == EngineState.READY) && slot.process?.isAlive == true

  fun anyLive(): Boolean = slots.values.any { it.state.live }

  /** An engine we run, or any process tagged with an agent (also from an earlier app process). */
  fun anyAlive(): Boolean = anyLive() || reaper.anyTagged(null)

  fun touch(agentId: String) {
    slots[agentId]?.lastUsedAt = System.currentTimeMillis()
  }

  /** Whether the agent's engine may stop, by its kind's idle rule (ManifestKind.isIdle). */
  fun isIdle(agentId: String, kind: ManifestKind): Boolean {
    val slot = slots[agentId]
    return kind.isIdle(slot?.lastEventAt, slot?.terminal?.lastOutputAt, System.currentTimeMillis())
  }

  /** A new viewer of the agent's TUI engine's terminal; throws not_running when it has none. */
  fun attachTerminal(agentId: String): TerminalViewers.Attached {
    val terminal = lock.withLock {
      slots[agentId]?.takeIf { it.state == EngineState.STARTING || it.state == EngineState.READY }?.terminal
    } ?: throw TerminalViewException(TerminalViewException.NOT_RUNNING, "the agent's engine is not a running TUI")
    return terminals.attach(terminal)
  }

  // An engine event that is activity: the engine is used, and not idle.
  private fun onActivity(agentId: String) {
    val slot = slots[agentId] ?: return
    val now = System.currentTimeMillis()
    slot.lastUsedAt = now
    slot.lastEventAt = now
  }

  // ---- start -------------------------------------------------------------

  /** A server engine's port, null for a TUI's; throws EngineStartException. Blocks (seeding, a possible eviction). */
  fun start(agentId: String, requestedAt: Long): Int? {
    val record = store.get(agentId) ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent")
    val kind = KindCatalogs.get(context).get(record.kind)
      ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent kind ${record.kind}")
    InstallGate.check(kind, record)
    models.check(record, kind)
    val gen = when (val seat = takeSeat(agentId)) {
      is Seat.Running -> return seat.port
      is Seat.Taken -> seat.gen
    }
    var port: Int? = null
    try {
      // Processes of this agent now are leftovers (a dead engine's
      // children, an engine from an earlier app process): end them first.
      reaper.stop(emptyList(), setOf(agentId))
      val plan = launcher.plan(record, kind, requestedAt).copy(model = models.endpoint(record, kind))
      val bridgeUrl = bridgeFor(kind)
      if (kind.style == EngineStyle.SERVER) {
        val alloc = ports.allocate(record.port?.toIntOrNull())
        port = alloc.port
        if (alloc.squatted) {
          TelemetryRecorder.portSquat()
          Log.w(TAG, "port ${record.port} taken, $agentId moves to ${alloc.port}")
        }
      }
      val proc = launcher.spawn(plan, port, bridgeUrl)
      if (!adopt(agentId, gen, plan, proc, port)) {
        reaper.stop(listOf(proc), setOf(agentId))
        throw EngineStartException(EngineStartError.START_FAILED, "stopped while starting")
      }
      val started = port
      port = null // the slot owns it now
      started?.let { savePort(agentId, it) }
      Log.i(TAG, "engine $agentId started" + (started?.let { " on $it" } ?: ""))
      return started
    } catch (e: Exception) {
      port?.let(ports::release)
      // Starts of one agent run one at a time, so no engine of it holds the model now.
      models.release(agentId)
      val failure = e as? EngineStartException
        ?: EngineStartException(EngineStartError.START_FAILED, e.message ?: e.javaClass.simpleName)
      fail(agentId, gen, failure)
      throw failure
    }
  }

  private sealed class Seat {
    data class Running(val port: Int?) : Seat()

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
        if ((slot.state == EngineState.STARTING || slot.state == EngineState.READY) && slot.process != null) {
          slot.lastUsedAt = System.currentTimeMillis()
          return Seat.Running(slot.port)
        }
        val seats = slots.values
          .filter { it !== slot && (it.state == EngineState.STARTING || it.state == EngineState.READY) }
          .map { EnginePolicy.Seat(it.agentId, it.usedAt() ?: 0L, it.state == EngineState.READY) }
        val cap = limits().maxAgents
        when (val decision = EnginePolicy.admit(seats, System.currentTimeMillis(), cap)) {
          EnginePolicy.Admission.Admit -> {
            slot.state = EngineState.STARTING
            slot.gen++
            slot.port = null
            slot.error = null
            slot.process = null
            slot.terminal = null
            slot.squatRelaunches = 0
            slot.lastUsedAt = System.currentTimeMillis()
            slot.lastEventAt = null
            started = slot.gen to slot.status()
          }
          is EnginePolicy.Admission.Evict -> evict = decision.agentId
          EnginePolicy.Admission.Reject -> throw EngineStartException(
            EngineStartError.TOO_MANY_RUNNING,
            "${agents(checkNotNull(cap))} running, the most you set in Settings, and none has been idle for a minute",
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
  // stopping the engine, launching it or relaunching it on a fresh port.
  private fun awaitSettled(slot: EngineSlot) {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(SETTLE_WAIT_MS)
    while (slot.state == EngineState.STOPPING || (slot.state == EngineState.STARTING && slot.process == null)) {
      val left = deadline - System.nanoTime()
      if (left <= 0) throw EngineStartException(EngineStartError.START_FAILED, "the engine is busy stopping")
      settled.awaitNanos(left)
    }
  }

  // The launched process becomes the slot's, unless a stop came in between.
  private fun adopt(agentId: String, gen: Int, plan: LaunchPlan, proc: EngineProcess, port: Int?): Boolean {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return false
      if (slot.gen != gen || slot.state != EngineState.STARTING) return false
      slot.process = proc
      slot.port = port
      slot.plan = plan
      slot.terminal = (proc as? TuiProcess)?.terminal
      slot.watch = watch(slot, proc, plan, port).also { it.start() }
      settled.signalAll()
      slot.status()
    }
    emit(status)
    return true
  }

  // A server is ready when its health probe answers; a TUI by its kind's
  // readiness, and only an exit other than 0 is its death.
  private fun watch(slot: EngineSlot, proc: EngineProcess, plan: LaunchPlan, port: Int?): EngineWatch {
    val terminal = (proc as? TuiProcess)?.terminal
    val dies = { status: Int -> terminal == null || status != 0 }
    val ready = if (terminal != null) {
      TuiReady.of(checkNotNull(plan.kind.tuiReadiness), { terminal.lastOutputAt }, System.currentTimeMillis())
    } else {
      HttpReady(plan.kind.healthProbe(checkNotNull(port).toString(), plan.record.password))
    }
    return EngineWatch(
      agentId = slot.agentId,
      process = proc,
      ready = ready,
      requestedAt = plan.requestedAt,
      secrets = { PathRedactor.agentSecrets(store.all(), KindCatalogs.get(context)) + ModelServerKeys.issued() },
      isDeath = dies,
      onReady = { onHealthy(slot.agentId, proc) },
      onSquatted = { onSquatted(slot.agentId, proc) },
      onBootTimeout = { timeoutMs -> onBootTimeout(slot.agentId, proc, timeoutMs) },
      onBootExit = { status -> ResumeFallback.applies(plan, status) && relaunchWithoutResume(slot.agentId, proc, status) },
      onUnexpectedExit = { status ->
        if (!relaunchWithoutResume(slot.agentId, proc, status, afterReady = true)) onExited(slot.agentId, proc, status, died = dies(status))
      },
    )
  }

  private fun fail(agentId: String, gen: Int, e: EngineStartException) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.gen != gen || slot.state != EngineState.STARTING) return
      slot.state = EngineState.FAILED
      slot.error = e.message
      slot.port = null
      slot.process = null
      slot.terminal = null
      settled.signalAll()
      slot.status()
    }
    models.release(agentId)
    Log.w(TAG, "engine $agentId failed to start: ${e.message}")
    emit(status)
    afterEngineGone()
  }

  // Lock-free (slots is concurrent, state and plan volatile): bridge
  // threads ask on every request. Only an engine that runs and was given
  // the bridge (BridgeAccess) is answered.
  private fun bridgeLive(agentId: String): Boolean {
    val slot = slots[agentId] ?: return false
    val live = slot.state.let { it == EngineState.STARTING || it == EngineState.READY }
    return live && slot.plan?.kind?.manifest?.let(BridgeAccess::granted) == true
  }

  // The bridge URL for an engine of [kind]: null when its kind has no phone
  // tools (it gets no bridge) or the bridge would not open.
  private fun bridgeFor(kind: ManifestKind): String? =
    if (BridgeAccess.granted(kind.manifest)) ensureBridge()?.url else null

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

  // Its next launch resumes (the kind's engine.resume).
  private fun markRan(agentId: String) {
    try {
      store.markRan(agentId)
    } catch (e: Exception) {
      Log.w(TAG, "first run not saved for $agentId", e)
    }
  }

  // ---- watch callbacks (watch threads) ----------------------------------

  private fun onHealthy(agentId: String, proc: EngineProcess) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.process !== proc || slot.state != EngineState.STARTING) return
      slot.state = EngineState.READY
      openStream(slot)
      slot.status()
    }
    markRan(agentId)
    emit(status)
  }

  // Another engine answered on our port, so ours never bound it: relaunch
  // on an OS-assigned port, a couple of times at most. While the port is
  // unknown the slot stays starting with no port, so a start waits for it.
  private fun onSquatted(agentId: String, proc: EngineProcess) {
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
      val next = launcher.spawn(plan, alloc.port, bridgeFor(plan.kind))
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

  // Its resume args may have found nothing to resume (ResumeFallback): the
  // same start, once more without them. [afterReady]: it exited once ready
  // (still nothing to resume when it raised no event), so it is starting
  // again. False when it does not apply or the start is no longer this one
  // (stopped meanwhile), so the exit counts as it would have.
  private fun relaunchWithoutResume(agentId: String, proc: EngineProcess, status: Int, afterReady: Boolean = false): Boolean {
    val plan: LaunchPlan
    val gen: Int
    var restarting: EngineStatus? = null
    lock.withLock {
      val slot = slots[agentId] ?: return false
      val launched = slot.plan ?: return false
      if (slot.process !== proc) return false
      if (afterReady) {
        if (slot.state != EngineState.READY) return false
        if (!ResumeFallback.appliesAfterReady(launched, status, sawEvent = slot.lastEventAt != null)) return false
        slot.events?.stop()
        slot.events = null
        slot.state = EngineState.STARTING
        restarting = slot.status()
      } else if (slot.state != EngineState.STARTING) {
        return false
      }
      // After ready its readiness clock starts again: the start was requested
      // long before (a first-run screen can wait for minutes).
      plan = ResumeFallback.without(launched).let { if (afterReady) it.copy(requestedAt = SystemClock.elapsedRealtime()) else it }
      gen = slot.gen
      slot.process = null
      slot.watch = null
      slot.terminal = null
    }
    restarting?.let(::emit)
    Log.w(TAG, "engine $agentId exited with $status ${if (afterReady) "before any event" else "before it was ready"}, resuming; launching it again without its resume args")
    reaper.stop(listOf(proc), setOf(agentId))
    try {
      val next = launcher.spawn(plan, null, bridgeFor(plan.kind), counted = false)
      if (!adopt(agentId, gen, plan, next, null)) reaper.stop(listOf(next), setOf(agentId))
    } catch (e: Exception) {
      fail(agentId, gen, e as? EngineStartException ?: EngineStartException(EngineStartError.START_FAILED, e.message ?: "relaunch failed"))
    }
    return true
  }

  private fun onBootTimeout(agentId: String, proc: EngineProcess, timeoutMs: Long) {
    if (lock.withLock { slots[agentId]?.process !== proc }) return
    terminate(setOf(agentId), EngineState.FAILED, "not ready after ${timeoutMs / 1000} s")
  }

  // An exit nobody asked for: died, or (a TUI that exited 0) stopped.
  private fun onExited(agentId: String, proc: EngineProcess, code: Int, died: Boolean) {
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      // A stop that is under way settles the slot itself.
      if (slot.process !== proc || slot.state == EngineState.STOPPING) return
      slot.watch = null
      slot.events?.stop()
      slot.events = null
      slot.process = null
      slot.terminal = null
      slot.port?.let(ports::release)
      slot.port = null
      slot.state = if (died) EngineState.DIED else EngineState.STOPPED
      slot.error = if (died) "exited with code $code" else null
      settled.signalAll()
      slot.status()
    }
    models.release(agentId)
    chats.detach(agentId)
    phoneControlGone(agentId)
    emit(status)
    afterEngineGone()
  }

  // The model server of these agents ended by itself: their engines can no
  // longer reach it, so they stop too (died, with why).
  private fun onModelDied(agentIds: Set<String>, detail: String) {
    Log.w(TAG, "local model gone, stopping ${agentIds.joinToString()}")
    terminate(agentIds, EngineState.DIED, "${EngineStartError.MODEL_UNAVAILABLE.code}: $detail")
  }

  // ---- stop --------------------------------------------------------------

  private fun up(state: EngineState) = state == EngineState.STARTING || state == EngineState.READY

  /** Blocks up to ~3 s. Also ends leftovers tagged with this agent when nothing runs. */
  fun stop(agentId: String) = terminate(setOf(agentId), EngineState.STOPPED, null)

  /** [agentIds] within one grace period. Blocks up to ~3 s. */
  fun stop(agentIds: Set<String>) = terminate(agentIds, EngineState.STOPPED, null)

  /**
   * Every engine and every tagged process, within one grace period, with
   * [reason] on their statuses when we stop them for one. Blocks up to ~3 s.
   */
  fun stopAll(reason: String? = null) = terminate(null, EngineState.STOPPED, reason)

  /** The memory guard's stop: as a user's, with why on its status (MemoryRules.STOPPED_REASON). Blocks up to ~3 s. */
  fun stopForMemory(agentId: String) = terminate(setOf(agentId), EngineState.STOPPED, MemoryRules.STOPPED_REASON)

  /**
   * Stops every agent on [modelId] (holding its server, or set to it with
   * an engine starting or ready) within one grace, then ends its server,
   * also while it loads. The agents it stopped. Blocks up to ~6 s.
   */
  fun stopModel(modelId: String): List<String> {
    val bound = store.all().filter { it.model == modelId && up(status(it.id).state) }.map { it.id }
    val agents = (models.holders(modelId) + bound).toSortedSet().toList()
    if (agents.isNotEmpty()) stop(agents.toSet())
    models.stop(modelId)
    return agents
  }

  /** stopAll on its own thread, for the service's main-thread callbacks. */
  fun stopAllAsync(reason: String? = null) {
    Thread({ stopAll(reason) }, "phonecando-engine-stop-all").apply {
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
    val engines = ArrayList<EngineProcess>()
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
            slot.events?.stop()
            slot.events = null
            slot.process?.let(engines::add)
            ending += slot to slot.gen
            stopping += slot.status()
          }
          else -> {}
        }
      }
    }
    stopping.forEach(::emit)
    ending.forEach { (slot, _) ->
      chats.detach(slot.agentId)
      phoneControlGone(slot.agentId)
    }
    // A stop-all ends the model servers in the same grace; otherwise each
    // agent's hold ends below, once its engine is gone.
    if (agentIds == null) models.stopAll()
    reaper.stop(engines, agentIds)
    ending.forEach { (slot, _) -> models.release(slot.agentId) }
    val ended = ArrayList<EngineStatus>()
    lock.withLock {
      for ((slot, gen) in ending) {
        if (slot.gen != gen || slot.state != EngineState.STOPPING) continue
        slot.process = null
        slot.terminal = null
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

  // The agent's ask-mode unlock for phone control ends with its engine.
  private fun phoneControlGone(agentId: String) {
    lock.withLock { bridge }?.agentGone(agentId)
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
    if (slot.events != null) return
    val plan = slot.plan ?: return
    val terminal = slot.terminal
    slot.events = try {
      if (terminal != null) {
        streams.openTui(slot.agentId, plan.kind, terminal, KitFiles.events(plan.home))
      } else {
        streams.open(slot.agentId, plan.kind, slot.port ?: return, plan.record.password)
      }
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

    fun agents(count: Int) = if (count == 1) "an agent is" else "$count agents are"
    const val MAX_SQUAT_RELAUNCHES = 2
    // Longest a start or stop waits for another call on the same engine.
    const val SETTLE_WAIT_MS = ProcessReaper.GRACE_MS + 3_000L
  }
}
