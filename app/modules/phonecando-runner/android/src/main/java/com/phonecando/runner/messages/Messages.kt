package com.phonecando.runner.messages

import android.content.Context
import android.util.Log
import com.phonecando.runner.acp.AcpRelay
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.ScreenNotices
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.starts.EngineStarts
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.messages.delivery.AcpCourier
import com.phonecando.runner.messages.delivery.InboxCourier
import com.phonecando.runner.messages.delivery.InboxFolder
import com.phonecando.runner.messages.delivery.KindInbox
import com.phonecando.runner.messages.delivery.RoutingCourier
import com.phonecando.runner.schedule.Schedules
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

// The process's one mailbox (Mailbox over files/state/messages.jsonl) and
// what feeds it: engine starts (EngineLauncher: the inbox folder and its
// pending set), engine statuses and chat-board changes (Engines.Listener:
// ready hands a server its set, gone ends a woken run, the board ends
// woken runs and hands sets again), an ACP turn ending (AcpRelay: a set
// that waits may go in now), receipts from the events files, and the
// screen line's notices (ScreenMessages). Sets go through RoutingCourier:
// as a prompt to an agent in ACP mode (AcpCourier), else as the kind's
// `inbox` says (InboxCourier); a set that may start a stopped agent asks
// the engine service for it (EngineStarts, in the mode StartRules picks);
// the service taking that request, or refusing it before any status, and
// the engine failing or dying first say how it went, and a start that
// failed holds the agent back (StartHolds; Android refusing the request is
// no failed start, and the set waits in the folder). Making it also sets
// the process's one ACP listener (AcpRelay), as every engine start makes
// it first.
// Everything but the start runs on one thread of its own, so a slow post
// to an engine never holds a stream or the bridge's screen ticker; a burst
// of board changes is handled once.
class Messages private constructor(context: Context) {
  private val app = context.applicationContext ?: context
  val view = LiveAgentsView(app)
  private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "phonecando-messages").apply { isDaemon = true } }
  private val boardDirty = AtomicBoolean(false)

  private val inbox = InboxCourier(
    plan = ::inboxPlan,
    folder = { agent ->
      if (KindCatalogs.get(app).get(agent.kind)?.inbox == null) {
        null
      } else {
        InboxFolder.of(ImageDir.of(app.filesDir, agent.imageId).home, agent.id)
      }
    },
    seat = view::serverSeat,
    onError = ::warn,
    scheduled = { agentId, scheduleId, sessionId -> Schedules.peek()?.delivered(agentId, scheduleId, sessionId) },
  )

  private val courier = RoutingCourier(
    inbox = inbox,
    acp = AcpCourier(AcpEngines::of, onError = ::warn),
    look = view::acpLook,
    folder = { agent -> inboxPlan(agent)?.folder == true },
    switchToAcp = { agent -> EngineStarts(app).start(agent.id, mode = EngineMode.ACP) == null },
    stopped = view::stopped,
    start = ::startFor,
  )

  val mailbox = Mailbox(
    log = MessageLog(MessageStore(File(app.filesDir, LOG)), System::currentTimeMillis, ::warn),
    agents = view,
    courier = courier,
    onChange = { MessageEvents.changed(unreadCounts()) },
    onError = ::warn,
    onStartFailed = StartHolds.shared::failed,
  )

  /** What the screen line tells agents, for the bridge's ScreenLease. */
  fun screenNotices(reservedMs: Long): ScreenNotices = ScreenMessages(mailbox, worker, reservedMs / 1000)

  private val listener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      when (status.state) {
        EngineState.READY -> later { mailbox.engineReady(status.agentId) }
        EngineState.STOPPED -> later { mailbox.engineGone(status.agentId) }
        EngineState.DIED, EngineState.FAILED -> later { mailbox.engineGone(status.agentId, status.error ?: "its engine ended") }
        else -> {}
      }
    }

    // At once (it only marks the start): a start waiting its turn is not given up.
    override fun onStartTaken(agentId: String) = mailbox.startTaken(agentId)

    override fun onStartFailed(agentId: String, why: String) = later { mailbox.startFailed(agentId, why) }

    override fun onChats() {
      if (!boardDirty.compareAndSet(false, true)) return
      later {
        boardDirty.set(false)
        mailbox.chatsChanged(Engines.peek()?.working().orEmpty())
      }
    }
  }

  init {
    Engines.addListener(listener)
    AcpRelay.install(app)
  }

  private fun inboxPlan(agent: AgentRecord) = KindCatalogs.get(app).get(agent.kind)?.let(KindInbox::of)

  // A stopped agent's start for its messages, in the mode its kind takes
  // them (StartRules.mode); false when Android refused the request (its
  // set waits for its next run; nothing is held: a schedule's alarm, Run
  // now and the app may still start it).
  private fun startFor(agent: AgentRecord): Boolean {
    val mode = view.startMode(agent) ?: return false
    return EngineStarts(app).start(agent.id, mode = mode) == null
  }

  /** The engine of [agentId] starts (EngineLauncher.plan, on the start thread): its inbox folder and pending set. */
  fun engineStarting(agentId: String) = mailbox.engineStarting(agentId)

  /** An `@inbox` receipt from [agentId]'s events file, with what the agent was doing as it was read (the lines after it may start a run). */
  fun receipt(agentId: String, ids: List<Long>) {
    val presence = view.presence(agentId)
    later { mailbox.receipt(agentId, ids, presence) }
  }

  /** [agentId]'s ACP turn is over (AcpRelay): a set that waits may go in as its next prompt. */
  fun acpIdle(agentId: String) = later { mailbox.engineReady(agentId) }

  /** The agent is deleted: its messages and its wake state go (its folder goes with its files, AgentFiles). */
  fun forget(agentId: String) = mailbox.forget(agentId)

  fun unreadCounts(): Map<String, Int> {
    val known = view.all().map { it.id }.toSet()
    return mailbox.unreadCounts().filterKeys { it in known }
  }

  private fun later(block: () -> Unit) {
    worker.execute {
      try {
        block()
      } catch (e: Exception) {
        warn("messages task failed", e)
      }
    }
  }

  private fun warn(message: String, e: Throwable) {
    Log.w(TAG, message, e)
  }

  companion object {
    private const val TAG = "PhoneCanDoMessages"

    /** The log, in app-private storage (never inside a machine). */
    const val LOG = "state/messages.jsonl"

    @Volatile private var instance: Messages? = null

    fun get(context: Context): Messages = instance ?: synchronized(this) {
      instance ?: Messages(context).also { instance = it }
    }

    /** The mailbox if anything made it yet. */
    fun peek(): Messages? = instance
  }
}
