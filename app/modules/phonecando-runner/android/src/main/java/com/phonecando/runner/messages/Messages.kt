package com.phonecando.runner.messages

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.ScreenNotices
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.messages.delivery.InboxCourier
import com.phonecando.runner.messages.delivery.InboxFolder
import com.phonecando.runner.messages.delivery.KindInbox
import com.phonecando.runner.engine.image.ImageDir
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

// The process's one mailbox (Mailbox over files/state/messages.jsonl) and
// what feeds it: engine starts (EngineLauncher: the inbox folder and its
// pending set), engine statuses and chat-board changes (Engines.Listener:
// ready hands a server its set, gone ends a woken run, the board ends
// woken runs and hands sets again), receipts from the events files, and the
// screen line's notices (ScreenMessages). Everything but the start runs on
// one thread of its own, so a slow post to an engine never holds a stream
// or the bridge's screen ticker; a burst of board changes is handled once.
class Messages private constructor(context: Context) {
  private val app = context.applicationContext ?: context
  val view = LiveAgentsView(app)
  private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "phonecando-messages").apply { isDaemon = true } }
  private val boardDirty = AtomicBoolean(false)

  private val courier = InboxCourier(
    plan = { agent -> KindCatalogs.get(app).get(agent.kind)?.let(KindInbox::of) },
    folder = { agent ->
      if (KindCatalogs.get(app).get(agent.kind)?.inbox == null) {
        null
      } else {
        InboxFolder.of(ImageDir.of(app.filesDir, agent.imageId).home, agent.id)
      }
    },
    seat = view::serverSeat,
    onError = ::warn,
  )

  val mailbox = Mailbox(
    log = MessageLog(MessageStore(File(app.filesDir, LOG)), System::currentTimeMillis, ::warn),
    agents = view,
    courier = courier,
    onChange = { MessageEvents.changed(unreadCounts()) },
    onError = ::warn,
  )

  /** What the screen line tells agents, for the bridge's ScreenLease. */
  fun screenNotices(reservedMs: Long): ScreenNotices = ScreenMessages(mailbox, worker, reservedMs / 1000)

  private val listener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      when (status.state) {
        EngineState.READY -> later { mailbox.engineReady(status.agentId) }
        EngineState.STOPPED, EngineState.DIED, EngineState.FAILED -> later { mailbox.engineGone(status.agentId) }
        else -> {}
      }
    }

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
  }

  /** The engine of [agentId] starts (EngineLauncher.plan, on the start thread): its inbox folder and pending set. */
  fun engineStarting(agentId: String) = mailbox.engineStarting(agentId)

  /** An `@inbox` receipt from [agentId]'s events file, with what the agent was doing as it was read (the lines after it may start a run). */
  fun receipt(agentId: String, ids: List<Long>) {
    val presence = view.presence(agentId)
    later { mailbox.receipt(agentId, ids, presence) }
  }

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
