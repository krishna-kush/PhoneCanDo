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
import com.phonecando.runner.bridge.mcp.McpToolAssets
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.checks.rules.CheckRules
import com.phonecando.runner.engine.acp.AcpAgent
import com.phonecando.runner.engine.acp.AcpCaps
import com.phonecando.runner.engine.acp.AcpExit
import com.phonecando.runner.engine.acp.AcpListing
import com.phonecando.runner.engine.acp.AcpProcess
import com.phonecando.runner.engine.acp.AcpReady
import com.phonecando.runner.engine.acp.AcpTurnWatch
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.proc.OsSignals
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.engine.ready.HttpReady
import com.phonecando.runner.engine.ready.TuiReady
import com.phonecando.runner.engine.spawn.TuiProcess
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.runner.engine.tui.HomeStarts
import com.phonecando.runner.engine.tui.TerminalViewException
import com.phonecando.runner.engine.tui.TerminalViewers
import com.phonecando.runner.engine.work.KeepRunning
import com.phonecando.runner.limits.RunLimits
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.messages.delivery.InboxFolder
import com.phonecando.runner.memory.MemoryRules
import com.phonecando.runner.models.ModelServer
import com.phonecando.runner.models.ModelServerKeys
import com.phonecando.runner.models.ModelSlots
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.models.prompt.PromptWatch
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.notify.ChatTracker
import com.phonecando.runner.notify.SilentTurnNotice
import com.phonecando.runner.prompts.AllowAll
import com.phonecando.runner.prompts.OpenUrlPrompts
import com.phonecando.runner.schedule.Schedules
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
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
// An agent runs in one mode at a time (EngineMode): a start in the other
// mode stops the engine first, unless ModeSwitch refuses (acp_busy,
// terminal_in_use); its hold on its model stays, so the model is not
// loaded again for the new mode. In ACP mode (a kind with engine.acp) its driver
// (engine/acp/AcpAgent) speaks ACP on the process's pipes: ready once it
// opened its chat (AcpReady), then it sends the start's task; it is idle
// only with no turn and no question open; a turn that goes silent
// (AcpTurnWatch) stops it with why (failed); any exit we did not ask for is
// a death, with the last line of its stderr, and never relaunches.
// A TUI engine's terminal stays with its slot while it runs; viewers attach
// to it through `terminals`. Stop: ask the engine to end (SIGTERM, or a
// TUI's hang-up) and SIGTERM every process tagged with its agent id, wait
// up to 3 s, SIGKILL the rest (ProcessReaper); stopping all does every
// agent within that one wait. The lock guards slot state only: seeding,
// spawning and waiting run outside it, and `gen` settles the races that
// leaves open. Blocking calls run off the main thread.
// Each launch is a new engine life for the capability checks
// (checks/Checks): its inbox folder's ran/ goes before the spawn, so each
// hook reports again, and the life starts as the slot adopts the process;
// its readiness, events, ACP opening or failure, exit, relaunch and end go
// there too, those that change the slot under the lock, so a racing start
// or stop never mixes up two lives.
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
  private val prompts: PromptWatch = ModelSlots.promptWatch(context, models, chats::working, ::anyAcpTurn) { listener.onPrompt(it) }
  private val streams = EngineStreams(
    onActivity = ::onActivity,
    alerts = AgentAlerts(context, store) { Bridge.screenHolder() == it },
    chats = chats,
    openUrl = { agentId, url -> OpenUrlPrompts.raise(context, store, agentId, url) },
    dropUrls = { agentId -> OpenUrlPrompts.end(context, agentId) },
    inboxRead = { agentId, ids ->
      Checks.receipt(agentId, ids)
      Messages.get(context).receipt(agentId, ids)
    },
    runEnded = Bridge::runEnded,
    checkEvent = Checks::engineEvent,
    scheduleEvent = { agentId, event -> Schedules.peek()?.engineEvent(agentId, event) },
    hookRan = Checks::hookRan,
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

  /** The agent's chats, the one on screen included, newest first (messages/: its state and chat). */
  fun chatsOf(agentId: String): List<ChatBoard.Chat> = chats.of(agentId)

  /** The agent's last top-level chat to move while it runs (messages/: where a server engine's messages go). */
  fun latestChat(agentId: String): String? = chats.latest(agentId)

  /** The agents with a run going (ChatBoard.working). */
  fun working(): Set<String> = chats.working()

  /** A model server reading a prompt for a bound agent's run; null when not (or not watched). */
  fun promptReading(): PromptReading? = prompts.current()

  /** The user has this agent's chat in front: its done and error chats go. */
  fun chatsSeen(agentId: String) = chats.seen(agentId)

  /** The chat on screen (by id, or a TUI's by title), whose ended run is seen; nulls for none. */
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

  /** isLive, in [mode]. */
  fun isLive(agentId: String, mode: EngineMode): Boolean =
    lock.withLock { slots[agentId]?.let { running(it) && it.mode == mode } == true }

  /** A viewer shows the agent's TUI now (EngineTerminal.hasViewer); false in ACP mode or when it does not run. */
  fun hasViewer(agentId: String): Boolean = slots[agentId]?.terminal?.hasViewer == true

  /** The agent's TUI terminal while its engine runs (cutoff/ keeps it to read your last input after an exit); null otherwise. */
  internal fun terminalOf(agentId: String): EngineTerminal? = slots[agentId]?.terminal

  /** The agent's ACP driver while its engine is ready in ACP mode (AcpEngines.of); null otherwise. */
  fun acpAgent(agentId: String): AcpAgent? =
    slots[agentId]?.takeIf { it.state == EngineState.READY && it.mode == EngineMode.ACP }?.acp

  // An ACP turn runs on some engine: the prompt watch looks, screen on or off (AcpTurnWatch).
  private fun anyAcpTurn(): Boolean = slots.values.any { it.acp?.turnRunning == true }

  /**
   * Why a start in [mode] would be refused now (ModeSwitch: the engine runs
   * in the other mode and cannot stop yet); null when it may go ahead. A
   * look at its jobs reads /proc, so off the main thread.
   */
  fun switchRefusal(agentId: String, mode: EngineMode): EngineStartException? {
    val live = liveAs(agentId, mode) ?: return null
    val refused = ModeSwitch.decide(mode, live) as? ModeSwitch.Decision.Refuse ?: return null
    return EngineStartException(refused.error, refused.detail)
  }

  // How the engine runs now, for a start in [want] (ModeSwitch); null
  // when it does not run. Its jobs are looked at only when they count.
  private fun liveAs(agentId: String, want: EngineMode): ModeSwitch.Live? {
    val slot = slots[agentId]?.takeIf { lock.withLock { running(it) } } ?: return null
    if (slot.mode == want) return ModeSwitch.Live(slot.mode)
    return when (slot.mode) {
      EngineMode.ACP -> ModeSwitch.Live(EngineMode.ACP, acpBusy = slot.acp.let { it == null || it.busy || it.asking })
      EngineMode.TERMINAL -> ModeSwitch.Live(
        EngineMode.TERMINAL,
        // A terminal Home asked for counts as watched until its view attaches (tui/HomeStarts).
        viewer = slot.terminal?.hasViewer == true || HomeStarts.pending(agentId),
        chatBusy = chats.busy(agentId),
        jobs = Engines.work()?.busyNow(agentId) == true,
      )
    }
  }

  private fun running(slot: EngineSlot): Boolean =
    (slot.state == EngineState.STARTING || slot.state == EngineState.READY) && slot.process?.isAlive == true

  fun anyLive(): Boolean = slots.values.any { it.state.live }

  /** An engine is starting (the wake lock holds the CPU for it). */
  fun anyStarting(): Boolean = slots.values.any { it.state == EngineState.STARTING }

  /** An engine we run, or any process tagged with an agent (also from an earlier app process). */
  fun anyAlive(): Boolean = anyLive() || reaper.anyTagged(null)

  fun touch(agentId: String) {
    slots[agentId]?.lastUsedAt = System.currentTimeMillis()
  }

  /**
   * Whether the agent's engine may stop, by its kind's idle rule
   * (ManifestKind.isIdle). Never while one of its chats is working: a long
   * tool call (a build, a test run) sends no events for minutes, and the
   * quiet rule alone would stop the engine mid-turn.
   */
  fun isIdle(agentId: String, kind: ManifestKind): Boolean {
    if (agentId in chats.working()) return false
    val slot = slots[agentId]
    // ACP mode: never with a turn running or a question open; what the
    // agent last sent counts as its output.
    val acp = slot?.let { if (it.mode == EngineMode.ACP) it.acp else null }
    if (acp != null && (acp.busy || acp.asking)) return false
    val output = if (acp != null) acp.lastHeardAt else slot?.terminal?.lastOutputAt
    return kind.isIdle(slot?.lastEventAt, output, System.currentTimeMillis())
  }

  /**
   * Epoch ms of the engine's last sign of work in this life: an activity
   * event, its TUI's output, or in ACP mode what it last sent; null for
   * none. Check now reads it to tell a slow run from a stuck one.
   */
  fun lastSignAt(agentId: String): Long? {
    val slot = slots[agentId] ?: return null
    val output = if (slot.mode == EngineMode.ACP) slot.acp?.lastHeardAt else slot.terminal?.lastOutputAt
    return listOfNotNull(slot.lastEventAt, output).maxOrNull()
  }

  /**
   * Epoch ms of the user's first input in the engine's life: a viewer's
   * first write to its TUI, or its first activity event; null before. What
   * the agent ran by then is the agent itself (engine/work/AgentWork).
   */
  fun firstInputAt(agentId: String): Long? {
    val slot = slots[agentId] ?: return null
    return listOfNotNull(slot.firstEventAt, slot.terminal?.firstInputAt).minOrNull()
  }

  /** A new viewer of the agent's TUI engine's terminal; throws not_running when it has none. */
  fun attachTerminal(agentId: String): TerminalViewers.Attached {
    val (terminal, mode) = lock.withLock {
      val slot = slots[agentId]?.takeIf { it.state == EngineState.STARTING || it.state == EngineState.READY }
      slot?.terminal to slot?.mode
    }
    val tui = terminal ?: throw TerminalViewException(
      TerminalViewException.NOT_RUNNING,
      if (mode == EngineMode.ACP) "the agent works in the background (ACP mode)" else "the agent's engine is not a running TUI",
    )
    return terminals.attach(tui)
  }

  // An engine event that is activity: the engine is used, and not idle.
  private fun onActivity(agentId: String) {
    val slot = slots[agentId] ?: return
    val now = System.currentTimeMillis()
    slot.lastUsedAt = now
    slot.lastEventAt = now
    if (slot.firstEventAt == null) slot.firstEventAt = now
  }

  // ---- start -------------------------------------------------------------

  /**
   * A server engine's port, null for a TUI's or ACP mode's; throws
   * EngineStartException. Running in the other [mode], it stops first
   * (ModeSwitch). Blocks (seeding, a possible eviction or switch).
   */
  fun start(agentId: String, requestedAt: Long, mode: EngineMode = EngineMode.TERMINAL): Int? {
    val record = store.get(agentId) ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent")
    val kind = KindCatalogs.get(context).get(record.kind)
      ?: throw EngineStartException(EngineStartError.START_FAILED, "unknown agent kind ${record.kind}")
    if (mode == EngineMode.ACP && !kind.speaksAcp) {
      throw EngineStartException(EngineStartError.START_FAILED, "${kind.displayName} has no ACP mode")
    }
    InstallGate.check(kind, record)
    // A Check now runs it on the check model when its kind takes one: its own model is not asked.
    val checkModel = CheckNow.modelFor(agentId, kind)
    if (checkModel == null) models.check(record, kind)
    val gen = when (val seat = takeSeat(agentId, mode)) {
      is Seat.Running -> return seat.port
      is Seat.Taken -> seat.gen
    }
    var port: Int? = null
    try {
      // Processes of this agent now are leftovers (a dead engine's
      // children, an engine from an earlier app process): end them first.
      reaper.stop(emptyList(), setOf(agentId))
      val base = launcher.plan(record, kind, requestedAt, mode)
      val own = if (checkModel == null) models.endpoint(record, kind) else null
      // Not on a model of its own this time (a Check now's, or none set now): a hold kept across a mode switch ends.
      if (own == null) models.release(agentId)
      val plan = base.copy(model = checkModel ?: own)
      val bridgeUrl = bridgeFor(kind)
      if (kind.style == EngineStyle.SERVER) {
        val alloc = ports.allocate(record.port?.toIntOrNull())
        port = alloc.port
        if (alloc.squatted) {
          TelemetryRecorder.portSquat()
          Log.w(TAG, "port ${record.port} taken, $agentId moves to ${alloc.port}")
        }
      }
      clearHookMarks(agentId, plan)
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

  // Already running in [mode]: its port. Running in the other mode: stops
  // it when ModeSwitch lets it, else refuses; a switch keeps the agent's
  // hold on its model, so the engine in the new mode joins its server still
  // up (and its prompt cache) instead of loading the model again. Otherwise
  // marks the slot starting once the policy admits it, stopping an idle
  // engine first when it says so.
  private fun takeSeat(agentId: String, mode: EngineMode): Seat {
    var kept = false
    try {
      return seat(agentId, mode) { kept = true }
    } catch (e: Exception) {
      // The new mode does not start: a hold the switch kept ends (the last one stops its server).
      if (kept && lock.withLock { slots[agentId]?.state?.let(::up) } != true) models.release(agentId)
      throw e
    }
  }

  // takeSeat's loop; [onSwitched] once it stopped the engine in the other mode, its model kept.
  private fun seat(agentId: String, mode: EngineMode, onSwitched: () -> Unit): Seat {
    var switches = 0
    while (true) {
      var evict: String? = null
      var started: Pair<Int, EngineStatus>? = null
      var other = false
      lock.withLock {
        val slot = slots.getOrPut(agentId) { EngineSlot(agentId) }
        awaitSettled(slot)
        if ((slot.state == EngineState.STARTING || slot.state == EngineState.READY) && slot.process != null) {
          if (slot.mode == mode) {
            slot.lastUsedAt = System.currentTimeMillis()
            return Seat.Running(slot.port)
          }
          other = true
          return@withLock
        }
        val seats = slots.values
          .filter { it !== slot && (it.state == EngineState.STARTING || it.state == EngineState.READY) }
          .map { EnginePolicy.Seat(it.agentId, it.usedAt() ?: 0L, it.state == EngineState.READY) }
        val cap = limits().maxAgents
        when (val decision = EnginePolicy.admit(seats, System.currentTimeMillis(), cap)) {
          EnginePolicy.Admission.Admit -> {
            slot.state = EngineState.STARTING
            slot.mode = mode
            slot.acp = null
            slot.gen++
            slot.port = null
            slot.error = null
            slot.process = null
            slot.terminal = null
            slot.squatRelaunches = 0
            slot.lastUsedAt = System.currentTimeMillis()
            slot.lastEventAt = null
            slot.firstEventAt = null
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
      if (other) {
        if (switches++ >= MAX_SWITCHES) throw EngineStartException(EngineStartError.START_FAILED, "it kept changing modes")
        switchRefusal(agentId, mode)?.let { throw it }
        Log.i(TAG, "switching $agentId to ${mode.wire} mode")
        terminate(setOf(agentId), EngineState.STOPPED, null, keepModel = true)
        onSwitched()
        continue
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
    var acp: AcpAgent? = null
    val status = lock.withLock {
      val slot = slots[agentId] ?: return false
      if (slot.gen != gen || slot.state != EngineState.STARTING) return false
      slot.process = proc
      slot.port = port
      slot.plan = plan
      slot.mode = plan.mode
      val terminal = (proc as? TuiProcess)?.terminal
      slot.terminal = terminal
      acp = (proc as? AcpProcess)?.let { driver(agentId, it, plan) }
      slot.acp = acp
      Checks.launched(agentId, plan) { terminal?.let(::screenOf) }
      slot.watch = watch(slot, proc, plan, port).also { it.start() }
      settled.signalAll()
      slot.status()
    }
    emit(status)
    acp?.open()
    return true
  }

  // An ACP engine's driver, told back here: a failed opening fails the
  // start, a turn's start and end change its status, what it hears marks
  // it used, its local model at work is a sign of life, and a silent turn
  // (left to Check now while it has the agent) stops it. Its "Allow
  // everything" answers its questions, except a Check now's (it rejects them).
  private fun driver(agentId: String, proc: AcpProcess, plan: LaunchPlan) = AcpAgent(
    agentId = agentId,
    process = proc,
    start = plan.prompt?.let { StartPrompt(it, plan.newChat, plan.sameChat) },
    storedChat = { store.get(agentId)?.acpChat },
    saveChat = { store.setAcpChat(agentId, it) },
    forgetChat = { store.clearAcpChat(agentId) },
    hooks = object : AcpAgent.Hooks {
      override fun onFailed(reason: String) = onAcpFailed(agentId, proc, reason)

      override fun onBusy(busy: Boolean) = emit(status(agentId))

      override fun onHeard() = touch(agentId)

      override fun modelBusy() = prompts.working(agentId)

      override fun endsSilentTurns() = !CheckNow.owns(agentId)

      override fun onSilent(reason: String) = onAcpSilent(agentId, proc, reason)

      override fun onCaps(caps: AcpCaps) = AcpListing.save(context, plan.kind.id, caps.list)
    },
    ownTools = { ownTools },
    allowsAll = { AllowAll.get(context).isOn(agentId) && !CheckNow.owns(agentId) },
  )

  // Our own tools' names, every channel's: an ACP agent's question about one never reaches you (OwnTools).
  private val ownTools: Set<String> by lazy { McpToolAssets.load(context, full = true).map { it.name }.toSet() }

  // A server is ready when its health probe answers; a TUI by its kind's
  // readiness, and only an exit other than 0 is its death.
  private fun watch(slot: EngineSlot, proc: EngineProcess, plan: LaunchPlan, port: Int?): EngineWatch {
    val terminal = (proc as? TuiProcess)?.terminal
    val acp = slot.acp
    // Any exit of a server or an ACP engine is a death; a TUI's only other than 0.
    val dies = { status: Int -> terminal == null || status != 0 }
    val ready = when {
      acp != null -> AcpReady({ acp.isReady }, AcpReady.timeoutOf(plan.kind))
      terminal != null ->
        TuiReady.of(checkNotNull(plan.kind.tuiReadiness), { terminal.lastOutputAt }, System.currentTimeMillis(), plan.prompt != null)
      else -> HttpReady(plan.kind.healthProbe(checkNotNull(port).toString(), plan.record.password))
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
    var closing: AcpAgent? = null
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.gen != gen || slot.state != EngineState.STARTING) return
      slot.state = EngineState.FAILED
      slot.error = e.message
      slot.port = null
      slot.process = null
      slot.terminal = null
      slot.acp?.let { closing = it }
      slot.acp = null
      Checks.ended(agentId, failed = true, detail = e.message)
      settled.signalAll()
      slot.status()
    }
    closing?.close("its start failed")
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
    val acp = lock.withLock {
      val slot = slots[agentId] ?: return
      if (slot.process !== proc || slot.state != EngineState.STARTING) return
      slot.state = EngineState.READY
      openStream(slot)
      slot.acp
    }
    Checks.ready(agentId)
    // In ACP mode ready means its chat opened (AcpReady).
    if (acp != null) Checks.acpOpened(agentId)
    // ACP mode: its first prompt now that its events are heard, before
    // anyone hears it is ready, so the task goes first.
    acp?.begin()
    markRan(agentId)
    emit(status(agentId))
  }

  // An ACP engine that could not open its chat (it wants a sign-in, say)
  // cannot work: its start fails with why, unless it is no longer this one.
  private fun onAcpFailed(agentId: String, proc: AcpProcess, reason: String) {
    if (lock.withLock { slots[agentId]?.let { it.process !== proc || it.state != EngineState.STARTING } != false }) return
    Log.w(TAG, "ACP engine $agentId failed: $reason")
    Checks.acpFailed(agentId, reason)
    terminate(setOf(agentId), EngineState.FAILED, reason)
  }

  // An ACP turn that said nothing for AcpTurnWatch.SILENT_MS was ended
  // (the driver takes no prompt any more): its engine stops with why, our
  // own starts hold back as after a failed start (StartHolds, set once it
  // is down), and you hear that it may need you in its own app. Off the
  // driver's timer thread, as a stop waits for the process.
  private fun onAcpSilent(agentId: String, proc: AcpProcess, reason: String) {
    thread(name = "phonecando-acp-silent-$agentId", isDaemon = true) {
      if (lock.withLock { slots[agentId]?.let { it.process !== proc || it.state != EngineState.READY } != false }) return@thread
      Log.w(TAG, "ACP engine $agentId stopped: its turn went silent")
      terminate(setOf(agentId), EngineState.FAILED, reason)
      StartHolds.shared.failed(agentId, AcpTurnWatch.HOLD_WHY)
      SilentTurnNotice.post(context, store.get(agentId))
    }
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
      Checks.relaunched(agentId, status)
    }
    restarting?.let(::emit)
    Log.w(TAG, "engine $agentId exited with $status ${if (afterReady) "before any event" else "before it was ready"}, resuming; launching it again without its resume args")
    reaper.stop(listOf(proc), setOf(agentId))
    try {
      clearHookMarks(agentId, plan)
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
    // An ACP engine has no screen: the last line it wrote to stderr says why.
    val reason = if (proc is AcpProcess) AcpExit.reason(code, stderrTail(proc)) else "exited with code $code"
    // A TUI's screen and whether you typed in it, for its task's check.
    val terminal = (proc as? TuiProcess)?.terminal
    val screen = terminal?.let(::screenOf)
    var closing: AcpAgent? = null
    val status = lock.withLock {
      val slot = slots[agentId] ?: return
      // A stop that is under way settles the slot itself.
      if (slot.process !== proc || slot.state == EngineState.STOPPING) return
      Checks.exited(agentId, code, died, reason, screen, typed = terminal?.firstInputAt != null)
      slot.watch = null
      slot.events?.stop()
      slot.events = null
      slot.process = null
      slot.terminal = null
      closing = slot.acp
      slot.acp = null
      slot.port?.let(ports::release)
      slot.port = null
      slot.state = if (died) EngineState.DIED else EngineState.STOPPED
      slot.error = if (died) reason else null
      settled.signalAll()
      slot.status()
    }
    closing?.close("the agent exited")
    models.release(agentId)
    chats.detach(agentId)
    phoneControlGone(agentId)
    emit(status)
    afterEngineGone()
  }

  // The end of a TUI's screen ring, for the checks; null when it cannot be read.
  private fun screenOf(terminal: EngineTerminal): ByteArray? = try {
    terminal.tail(CheckRules.SCREEN_BYTES).first
  } catch (_: Exception) {
    null
  }

  // Before a launch spawns: the hooks' marks of the last life go
  // (InboxFolder ran/), so each reports once more in the new one (checks/).
  private fun clearHookMarks(agentId: String, plan: LaunchPlan) {
    try {
      InboxFolder.of(plan.image.home, agentId).clearRan()
    } catch (e: Exception) {
      Log.w(TAG, "hook marks of $agentId not cleared", e)
    }
  }

  // The redacted end of an ACP engine's stderr; null when it cannot be read.
  private fun stderrTail(proc: AcpProcess): String? = try {
    proc.outputTail(STDERR_WINDOW_BYTES)?.let { (window, cut) ->
      TelemetryRecorder.redactedTail(window, midFile = cut, secrets = PathRedactor.agentSecrets(store.all(), KindCatalogs.get(context)))
    }
  } catch (_: Exception) {
    null
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

  /** Drops a deleted agent's slot, its Keep running and its Allow everything; stop it first. */
  fun forget(agentId: String) {
    KeepRunning.get(context).forget(agentId)
    AllowAll.get(context).forget(agentId)
    lock.withLock {
      val slot = slots[agentId] ?: return
      if (!slot.state.live) slots.remove(agentId)
    }
  }

  // agentIds null: all agents, and processes tagged with any agent id.
  // [keepModel]: their holds on their models stay (a mode switch's stop).
  private fun terminate(agentIds: Set<String>?, final: EngineState, error: String?, keepModel: Boolean = false) {
    val engines = ArrayList<EngineProcess>()
    val ending = ArrayList<Pair<EngineSlot, Int>>()
    val others = ArrayList<EngineSlot>()
    val stopping = ArrayList<EngineStatus>()
    val drivers = ArrayList<AcpAgent>()
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
            slot.acp?.let(drivers::add)
            slot.process?.let(engines::add)
            ending += slot to slot.gen
            stopping += slot.status()
          }
          else -> {}
        }
      }
    }
    stopping.forEach(::emit)
    // An ACP turn ends with its engine; closing its stdin lets it end first.
    drivers.forEach { it.close("the agent was stopped") }
    ending.forEach { (slot, _) ->
      chats.detach(slot.agentId)
      phoneControlGone(slot.agentId)
    }
    // A stop-all ends the model servers in the same grace; otherwise each
    // agent's hold ends below, once its engine is gone.
    if (agentIds == null) models.stopAll()
    reaper.stop(engines, agentIds)
    if (!keepModel) ending.forEach { (slot, _) -> models.release(slot.agentId) }
    val ended = ArrayList<EngineStatus>()
    lock.withLock {
      for ((slot, gen) in ending) {
        if (slot.gen != gen || slot.state != EngineState.STOPPING) continue
        slot.process = null
        slot.terminal = null
        slot.acp = null
        slot.port?.let(ports::release)
        slot.port = null
        slot.state = final
        slot.error = error
        Checks.ended(slot.agentId, failed = final != EngineState.STOPPED, detail = error)
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
    val acp = slot.acp
    slot.events = try {
      when {
        acp != null -> streams.openAcp(slot.agentId, acp, plan.eventsFile)
        terminal != null -> streams.openTui(slot.agentId, plan.kind, terminal, plan.eventsFile)
        else -> streams.open(slot.agentId, plan.kind, slot.port ?: return, plan.record.password)
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

    // Stops for a mode switch one start makes at most (another start may switch it back meanwhile).
    const val MAX_SWITCHES = 2

    // Of an ACP engine's stderr, read for the line that says why it died.
    const val STDERR_WINDOW_BYTES = 16 * 1024
    // Longest a start or stop waits for another call on the same engine.
    const val SETTLE_WAIT_MS = ProcessReaper.GRACE_MS + 3_000L
  }
}
