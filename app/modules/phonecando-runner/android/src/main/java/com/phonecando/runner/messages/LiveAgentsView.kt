package com.phonecando.runner.messages

import android.content.Context
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.starts.LiveStartRoom
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.engine.tui.HomeStarts
import com.phonecando.runner.jobs.JobsAnchor
import com.phonecando.runner.memory.MemoryStops
import com.phonecando.runner.messages.delivery.AcpRoute
import com.phonecando.runner.messages.delivery.InboxFolder
import com.phonecando.runner.messages.delivery.KindInbox
import com.phonecando.runner.messages.delivery.ServerSeat
import com.phonecando.runner.messages.start.StartRules
import com.phonecando.runner.notify.AppForeground
import com.phonecando.runner.notify.ChatBoard

// The agents as the running app has them: the store's records, the kinds
// (KindCatalogs: label, `inbox.wake` or an ACP mode; a waiting hook's
// `waiter` file for a kind that wakes through one), the messaging level
// that works now (Checks.levelNow: a capability found not working drops it
// below what the kind declares), each engine's state and chats (the
// supervisor's chat board: waiting when a chat waits for the user, working
// when one runs, else idle), the screen line of the open bridge and each
// agent's status line (presence/). Also
// where a server engine takes its messages (ServerSeat): its port and
// password while it runs, and its working chat, else its latest; and, for a
// kind with an ACP mode, which mode its engine runs in and whether it is
// free (AcpRoute.Look): someone watches its terminal when a view shows it,
// or, with the app in front, Home asked for it and its view has not
// attached yet (HomeStarts). For a stopped agent, whether a message may
// start it and in which mode (start/StartRules): its kind, its level now,
// a Linux job on its machine (JobsAnchor), Check now (CheckNow.owns), Home
// opening it, a failed start (StartHolds) or a memory stop (MemoryStops)
// lately, then the phone's room (LiveStartRoom).
class LiveAgentsView(context: Context) : AgentsView {
  private val app = context.applicationContext ?: context

  override fun all(): List<AgentRecord> = AgentStores.get(app).all()

  override fun kindLabel(kind: String): String = KindCatalogs.get(app).get(kind)?.displayName ?: kind

  // An idle agent of a kind with an ACP mode is woken with a prompt in
  // that mode, whatever its `inbox.wake`.
  override fun kindCanWake(kind: String): Boolean = KindCatalogs.get(app).get(kind)?.let { it.canWake || it.speaksAcp } == true

  override fun kindLevel(kind: String): MessagingLevel =
    KindCatalogs.get(app).get(kind)?.let { Checks.levelNow(it) } ?: MessagingLevel.NONE

  // A kind with an ACP mode: ready now when idle in ACP mode, or free to
  // switch to it (AcpRoute.readyToWake); else only through its own
  // `inbox.wake`, as below. A kind that wakes through a waiting hook: that
  // hook writes its pid to the inbox folder's `waiter` and removes it when
  // it ends.
  override fun wakeReady(agent: AgentRecord): Boolean {
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return false
    if (kind.speaksAcp) {
      if (AcpRoute.readyToWake(acpLook(agent))) return true
      if (!kind.canWake) return false
    }
    if (!kind.wakeNeedsWaiter) return true
    return InboxFolder.of(ImageDir.of(app.filesDir, agent.imageId).home, agent.id).waiterAlive()
  }

  // An engine still stopping is no start: its messages wait for its next run.
  override fun startRefusal(agent: AgentRecord): String? {
    if (!stopped(agent)) return STOPPING
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return StartRules.NEVER
    val look = StartRules.Look(
      speaksAcp = kind.speaksAcp,
      wakesByServer = KindInbox.of(kind)?.wakesByServer == true,
      levelWakes = Checks.levelNow(kind) == MessagingLevel.WAKES,
      installing = JobsAnchor.linuxJobs().any { it.target.kind == JobTarget.Kind.IMAGE && it.target.id == agent.imageId },
      checking = CheckNow.owns(agent.id),
      opening = HomeStarts.pending(agent.id) && AppForeground.isForeground(app),
      failed = StartHolds.shared.why(agent.id),
      memoryStopAt = MemoryStops.at(agent.id),
      now = System.currentTimeMillis(),
    )
    return StartRules.refusal(look) { LiveStartRoom(app).refusal() }
  }

  /** The mode a message starts [agent] in (StartRules.mode); null when it never does. */
  fun startMode(agent: AgentRecord): EngineMode? {
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return null
    return StartRules.mode(kind.speaksAcp, KindInbox.of(kind)?.wakesByServer == true)
  }

  /** Nothing of [agent]'s engine runs: stopped, failed or died (not starting, ready or stopping). */
  fun stopped(agent: AgentRecord): Boolean = Engines.peek()?.status(agent.id)?.state?.live != true

  /** [agent] as message routing sees it (AcpRoute.Look.NONE for a kind without an ACP mode). */
  fun acpLook(agent: AgentRecord): AcpRoute.Look {
    if (KindCatalogs.get(app).get(agent.kind)?.speaksAcp != true) return AcpRoute.Look.NONE
    val engines = Engines.peek() ?: return AcpRoute.Look.NONE.copy(speaksAcp = true)
    val status = engines.status(agent.id)
    val handle = AcpEngines.of(agent.id)
    val work = Engines.work()?.states()?.get(agent.id)
    return AcpRoute.Look(
      speaksAcp = true,
      acpReady = handle != null,
      acpMode = handle != null || (status.mode == EngineMode.ACP && status.state.live),
      acpBusy = acpTurn(agent.id),
      terminalReady = status.state == EngineState.READY && status.mode == EngineMode.TERMINAL,
      idle = presence(agent.id).idle,
      viewer = engines.hasViewer(agent.id) || (HomeStarts.pending(agent.id) && AppForeground.isForeground(app)),
      // As the engine's switch counts them (ModeSwitch): jobs, or kept running.
      jobs = work != null && (work.busy || work.held),
    )
  }

  // A turn runs in ACP mode. An engine started for a message's prompt is
  // busy until that prompt comes (waitingForWork), but free to take it.
  private fun acpTurn(agentId: String): Boolean {
    val handle = AcpEngines.of(agentId) ?: return false
    return handle.busy && !handle.waitingForWork
  }

  override fun presence(agentId: String): Presence {
    val engines = Engines.peek() ?: return Presence.STOPPED
    when (engines.status(agentId).state) {
      EngineState.READY -> {}
      EngineState.STARTING -> return Presence(AgentState.STARTING)
      else -> return Presence.STOPPED
    }
    val chats = engines.chatsOf(agentId)
    // An ACP turn runs from its prompt, before the board may show it.
    val state = when {
      chats.any { it.state == ChatBoard.State.WAITING } -> AgentState.WAITING
      chats.any { it.state == ChatBoard.State.WORKING } -> AgentState.WORKING
      acpTurn(agentId) -> AgentState.WORKING
      else -> AgentState.IDLE
    }
    val latest = engines.latestChat(agentId)
    val chat = chats.firstOrNull { it.state == ChatBoard.State.WORKING } ?: chats.firstOrNull { it.sessionId == latest } ?: chats.firstOrNull()
    return Presence(state, chat?.title)
  }

  // presence.Presence, not this package's Presence (an agent's state).
  override fun status(agentId: String): Pair<String, String>? =
    com.phonecando.runner.presence.Presence.store.statuses()[agentId]?.let { it.text to it.mood.name.lowercase() }

  override fun screen(): ScreenLine {
    val line = Bridge.screenLine() ?: return ScreenLine.NONE
    return ScreenLine(line.holder?.agentId, line.reserved, line.waiting.map { it.agentId })
  }

  /** A ready server engine's port and password and the chat to post to; null when it has no port. */
  fun serverSeat(agent: AgentRecord): ServerSeat? {
    val engines = Engines.peek() ?: return null
    val port = engines.livePort(agent.id) ?: return null
    if (engines.status(agent.id).state != EngineState.READY) return null
    val working = engines.chatsOf(agent.id).firstOrNull { it.state == ChatBoard.State.WORKING }?.sessionId
    return ServerSeat(port.toString(), agent.password, working ?: engines.latestChat(agent.id))
  }

  private companion object {
    const val STOPPING = "it is stopping"
  }
}
