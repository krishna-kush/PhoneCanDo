package com.phonecando.runner.checks.now

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.InstallGate
import com.phonecando.runner.checks.CheckChange
import com.phonecando.runner.checks.CheckState
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.LifeEvent
import com.phonecando.runner.checks.fanout.ChecksEvents
import com.phonecando.runner.checks.now.model.CheckModel
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.acp.AcpPermissionAsk
import com.phonecando.runner.jobs.JobsAnchor
import com.phonecando.runner.messages.AgentState
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.AppForeground
import com.phonecando.runner.notify.CheckNotices
import com.phonecando.runner.schedule.EngineStarts
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// Check now (the agent page): one short task that asks for no tools, so
// the capabilities it touches get checked without waiting for real use.
// - refused (CheckNowRules) for an unknown agent or kind, a kind that
//   can't start with a task, a check already running, its machine
//   installing, it not installed yet, or its run going.
// - the check model (model/CheckModel): while its check runs, each start of
//   the agent's engine runs it on our stand-in model, which answers "done"
//   at once, when its kind takes a model (modelFor, from EngineSupervisor),
//   so no model's speed or answer decides it; else on its own model. The
//   stand-in stops once no check runs, and an engine on it never outlives
//   its check (release).
// - its parts (CheckNowRules.plan): ACP mode first when its kind has one,
//   then its own app on the same chat; else its own app alone; each with
//   the declared capabilities it tests (its rows). Each part stops the
//   agent's engine when live (an ACP turn cancelled first, as Schedules
//   restart an idle agent), then starts it with the part's task as its
//   first prompt (schedule/EngineStarts), on a thread of our own, as a stop
//   blocks up to ~3 s.
// - each verdict for the agent (Checks' onChange, through checks/fanout)
//   answers its row; a part whose rows all have answers ends at once.
// - while it runs, a tick each second looks at the agent (CheckSampler)
//   and moves its run (CheckRuns): its step, movement, the next part,
//   done, or stuck. Turn and engine ends come from Checks' onLife.
// - an ACP permission question while it runs is answered with a reject at
//   once (acp/AcpRelay asks rejects()), with no prompt for you.
// - waiting for you in its own app (CheckRuns): one notification whose tap
//   opens it there, as soon as the app is not in front (each tick looks
//   again while it waits); gone once the check moves on. It runs on until
//   you answer, cancel, or CHECK_MAX_MS.
// - while a check runs the CPU stays awake (running(), the service's
//   power/WorkLock), so its ticks and its notice go on with the screen off.
// - done, stuck or failed: its engine stops (the check started it) unless
//   a view shows its terminal, and with the app not in front one
//   notification says how it went (notify/CheckNotices).
// - Cancel: cancelled, its ACP turn cancelled, its engine stopped.
// - either way, an engine on the check model with its terminal on your
//   screen starts again on its own model, so you never work with the
//   stand-in; and the agent gets back the chat it was in before the check
//   (ChatsBefore), so its next own-app start opens that, not the check's.
// Every change you see tells the app (ChecksEvents). Kept until the next
// check or the agent is gone.
object CheckNow {
  private const val TAG = "PhoneCanDoChecks"

  private val runs = CheckRuns(System::currentTimeMillis)

  private val worker: ScheduledExecutorService by lazy {
    Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "phonecando-check-now").apply { isDaemon = true } }
  }

  private val ticking = AtomicBoolean(false)

  /** The agents whose check's waiting notice is up. */
  private val waitNoticed: MutableSet<String> = ConcurrentHashMap.newKeySet()

  /** The agents whose check started their engine on the check model. */
  private val onCheckModel: MutableSet<String> = ConcurrentHashMap.newKeySet()

  /** The chat each agent was in before its check. */
  private val chatsBefore = ChatsBefore()

  /** The agents whose check is over but whose engine is not released yet. */
  private val releasing: MutableSet<String> = ConcurrentHashMap.newKeySet()

  @Volatile private var app: Context? = null

  /**
   * Starts a check of [agentId]: every capability when [full], else only
   * those not checked yet (Check the rest); null when it started, else why not.
   */
  fun start(context: Context, agentId: String, full: Boolean): String? {
    val app = context.applicationContext ?: context
    val agent = AgentStores.get(app).get(agentId) ?: return CheckNowRules.NO_AGENT
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return CheckNowRules.NO_KIND
    CheckNowRules.refusal(look(app, agent, kind))?.let { return it }
    val declared = declared(kind, agent)
    val done = if (full) emptySet() else checked(kind, agent)
    if (declared.isNotEmpty() && done.containsAll(declared)) return CheckNowRules.NOTHING_LEFT
    val plan = CheckNowRules.plan(kind.promptsAtStart, kind.speaksAcp, kind.opensChat, declared, done)
      ?: return if (done.isEmpty()) CheckNowRules.CANT else CheckNowRules.CANT_LEFT
    if (!runs.begin(agentId, plan)) return CheckNowRules.CHECKING
    chatsBefore.began(agentId, agent.acpChat)
    this.app = app
    changed(agentId)
    val first = plan.parts[0]
    worker.execute { launch(app, agentId, 1, first) }
    tickSoon()
    return null
  }

  /** Cancel check: false when no check of [agentId] runs. */
  fun cancel(context: Context, agentId: String): Boolean {
    if (!runs.cancel(agentId)) return false
    changed(agentId)
    val app = context.applicationContext ?: context
    releasing += agentId
    worker.execute { release(app, agentId, keepForViewer = false) }
    return true
  }

  /** Whether any check runs (the service keeps the CPU awake meanwhile). */
  fun running(): Boolean = runs.active()

  /**
   * Whether [agentId]'s runs are its check's now: the check runs, or it
   * ended and its engine is not released yet. Its run alerts stay quiet
   * (notify/AgentAlerts): the check's own notices say how it went.
   */
  fun owns(agentId: String): Boolean = runs.get(agentId)?.running == true || agentId in releasing

  /** How many parts a Check now of [kind] runs; 0 when it can't. */
  fun parts(kind: ManifestKind): Int = CheckNowRules.parts(kind.promptsAtStart, kind.speaksAcp, kind.opensChat)

  /** What Check the rest would run for [agent]: its parts; null when nothing it can test is left. */
  fun rest(kind: ManifestKind, agent: AgentRecord): CheckPlan? =
    CheckNowRules.plan(kind.promptsAtStart, kind.speaksAcp, kind.opensChat, declared(kind, agent), checked(kind, agent))

  /**
   * The model [agentId]'s engine starts on (EngineSupervisor, at each start):
   * while its check runs, the check model when [kind] takes one; null for
   * its own setup.
   */
  fun modelFor(agentId: String, kind: ManifestKind): ModelEndpoint? {
    if (runs.get(agentId)?.running != true) return null
    val endpoint = CheckModel.endpointFor(kind) ?: return null
    onCheckModel += agentId
    return endpoint
  }

  /** [agentId]'s last check; null when it had none. */
  fun run(agentId: String): CheckRun? = runs.get(agentId)

  /** A verdict (Checks' onChange): it answers its row; the next tick ends a part that has all its answers. */
  fun verdict(change: CheckChange) {
    if (runs.verdict(change.agentId, change.capability.wire, change.record.state == CheckState.FAILED)) changed(change.agentId)
  }

  /**
   * An ACP permission question of [agentId] (acp/AcpRelay): while a check
   * runs for it, answered at once with a reject (else cancelled), and true,
   * so no prompt is raised; false when no check runs.
   */
  fun rejects(agentId: String, ask: AcpPermissionAsk): Boolean {
    if (runs.get(agentId)?.running != true) return false
    try {
      AcpEngines.of(agentId)?.answerPermission(ask.requestId, CheckNowRules.rejectOption(ask.options))
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: its permission question not answered", e)
    }
    return true
  }

  /** An engine life's news (Checks' onLife): a turn end shows on the next tick. */
  fun life(agentId: String, event: LifeEvent) {
    when (event) {
      is LifeEvent.TurnEnded -> runs.turnEnded(agentId, event.mode, event.end)
      is LifeEvent.EngineEnded -> {
        val live = Engines.peek()?.status(agentId)?.state?.live == true
        if (runs.engineEnded(agentId, event.failed, event.detail, live)) {
          changed(agentId)
          app?.let { ended(it, agentId) }
        }
      }
    }
  }

  /** The agent is gone: its run goes too. */
  fun forget(agentId: String) {
    runs.forget(agentId)
    waitNoticed.remove(agentId)
    onCheckModel.remove(agentId)
    chatsBefore.take(agentId)
    releasing -= agentId
  }

  private fun look(app: Context, agent: AgentRecord, kind: ManifestKind): CheckNowRules.Look {
    val state = Messages.get(app).view.presence(agent.id).state
    return CheckNowRules.Look(
      prompts = kind.promptsAtStart,
      acp = kind.speaksAcp,
      checking = runs.get(agent.id)?.running == true,
      installing = JobsAnchor.linuxJobs().any { it.target.kind == JobTarget.Kind.IMAGE && it.target.id == agent.imageId },
      notInstalled = InstallGate.needsInstall(kind, agent),
      busy = state == AgentState.WORKING || state == AgentState.WAITING,
    )
  }

  // What [agent] declares, by wire id (state only when it keeps its own).
  private fun declared(kind: ManifestKind, agent: AgentRecord): Set<String> =
    Checks.view(kind, agent).filter { it.state != CheckState.OFF }.map { it.capability.wire }.toSet()

  private fun checked(kind: ManifestKind, agent: AgentRecord): Set<String> =
    Checks.view(kind, agent).filter { it.state == CheckState.CHECKED }.map { it.capability.wire }.toSet()

  // Part [number]: its engine stopped when live, then started as [part] says.
  // Past the first, the engine that stops is the check's own.
  private fun launch(app: Context, agentId: String, number: Int, part: CheckPlan.Part) {
    val why = try {
      if (number > 1) noteChatBefore(agentId)
      stop(app, agentId)
      EngineStarts(app).start(agentId, part.task, part.newChat, part.mode)
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId did not start", e)
      "It didn't start: " + (e.message ?: "no detail")
    }
    if (why == null) {
      runs.launched(agentId, number)
    } else if (runs.refused(agentId, why)) {
      changed(agentId)
      ended(app, agentId)
    }
  }

  // The run ended done, stuck or failed: its engine is released, and with
  // the app not in front you hear how it went.
  private fun ended(app: Context, agentId: String) {
    releasing += agentId
    worker.execute { release(app, agentId, keepForViewer = true) }
    val run = runs.get(agentId) ?: return
    if (AppForeground.isForeground(app)) return
    try {
      CheckNotices(app).postRun(agentId, run)
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: no notice", e)
    }
  }

  // The run is over: the engine it started stops, unless a view shows its
  // terminal and [keepForViewer]. On the check model it stops even then,
  // and with a view on its terminal starts again on its own model. The
  // agent gets its chat from before the check back first, so that start,
  // and any later one, opens it.
  private fun release(app: Context, agentId: String, keepForViewer: Boolean) {
    val viewer = Engines.peek()?.hasViewer(agentId) == true
    val standIn = onCheckModel.remove(agentId)
    try {
      noteChatBefore(agentId)
      if (standIn || !(viewer && keepForViewer)) stop(app, agentId)
      giveChatBack(app, agentId)
    } finally {
      releasing -= agentId
    }
    if (standIn && viewer) EngineStarts(app).start(agentId)
  }

  // The check's ACP part, while it runs: the chat it would have gone back to.
  private fun noteChatBefore(agentId: String) {
    try {
      chatsBefore.noted(agentId, AcpEngines.of(agentId)?.chatBefore)
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: its chat before not read", e)
    }
  }

  // The chat it was in before the check becomes its kept chat again
  // (the check's parts left their own there, or a terminal launch cleared it).
  private fun giveChatBack(app: Context, agentId: String) {
    val chat = chatsBefore.take(agentId) ?: return
    try {
      AgentStores.get(app).setAcpChat(agentId, chat)
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: its chat not given back", e)
    }
  }

  // Its ACP turn cancelled, then its engine stopped; nothing when it doesn't run.
  private fun stop(app: Context, agentId: String) {
    if (Engines.peek()?.status(agentId)?.state?.live != true) return
    try {
      AcpEngines.of(agentId)?.takeIf { it.busy }?.cancel()
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: its ACP turn not cancelled", e)
    }
    EngineStarts(app).stop(agentId)
  }

  private fun tickSoon() {
    if (ticking.compareAndSet(false, true)) worker.schedule(Runnable { tick() }, CheckRuns.TICK_MS, TimeUnit.MILLISECONDS)
  }

  private fun tick() {
    try {
      val app = this.app ?: return
      val samples = runs.going().mapValues { (agentId, mode) -> CheckSampler.sample(app, agentId, mode) }
      for (t in runs.tick(samples)) {
        if (t.changed) changed(t.agentId)
        when (val action = t.action) {
          is CheckRuns.Action.Advance -> worker.execute { launch(app, t.agentId, action.number, action.part) }
          CheckRuns.Action.Ended -> ended(app, t.agentId)
          null -> {}
        }
      }
      // While one waits for you, each tick looks again whether you are away.
      for (agentId in samples.keys) if (runs.get(agentId)?.step == CheckRun.Step.WAITING) waits(app, agentId)
    } catch (e: Exception) {
      Log.w(TAG, "check tick failed", e)
    } finally {
      // Off first, then a look: a check begun meanwhile ticks on.
      ticking.set(false)
      if (runs.active()) tickSoon() else CheckModel.stop()
    }
  }

  private fun changed(agentId: String) {
    ChecksEvents.changed(agentId)
    app?.let { waits(it, agentId) }
  }

  // Its check waits for you in its own app: once the app is not in front,
  // one notice; it goes once the check moves on (an end's own notice comes
  // after, ended()).
  private fun waits(app: Context, agentId: String) {
    val waiting = runs.get(agentId)?.let { it.running && it.step == CheckRun.Step.WAITING } == true
    try {
      if (waiting) {
        if (!AppForeground.isForeground(app) && waitNoticed.add(agentId)) CheckNotices(app).postWaiting(agentId)
      } else if (waitNoticed.remove(agentId)) {
        CheckNotices(app).cancelRun(agentId)
      }
    } catch (e: Exception) {
      Log.w(TAG, "check of $agentId: no waiting notice", e)
    }
  }
}
