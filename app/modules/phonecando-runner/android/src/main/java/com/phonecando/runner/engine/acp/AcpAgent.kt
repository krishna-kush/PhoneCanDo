package com.phonecando.runner.engine.acp

import android.util.Log
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.engine.StartPrompt
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicLong

// The driver of one live ACP engine (one per engine life). open() starts
// it on its own steps thread: initialize, then the chat (AcpChats: a new
// one when this start's task wants that, else the newest), kept as the
// agent's (AgentRecord.acpChat), with the kind's options set; then it is
// ready (AcpReady). A start with a chat of its own also notes the chat it
// would have gone back to (chatBefore, AcpChats.before). begin(), once the
// supervisor hears its events, sends the start's task as its first
// prompt. We start ACP mode only for work
// (a task, or a message that wakes it), so it is busy from its start
// until that work's turn ends: a start with no task waits WORK_WAIT_MS
// after ready for its work (a waking message's prompt) before it counts as
// idle, and the first prompt() takes that wait over. So Home never takes
// it back to the terminal before its work began. A prompt is one turn at
// a time (busy until the agent answers it); one for a new chat opens that
// first.
// While a turn runs, what the agent sends folds into its items (AcpTurn),
// and its permission questions wait for answerPermission (or cancel,
// which answers them cancelled). Its turn's course goes out as engine
// events (AcpEvents, to [events]), and everything to AcpEngines.listener.
// Any other request of the agent's is refused (not offered). close()
// ends it with its engine. Never logs what goes over the pipes.
internal class AcpAgent(
  override val agentId: String,
  private val process: AcpProcess,
  /** This start's task (StartPrompts): its first prompt, and whether it wants a chat of its own. */
  private val start: StartPrompt?,
  /** The chat we kept for it (AgentRecord.acpChat). */
  private val storedChat: () -> String?,
  /** Keeps the chat it works in (AgentStore.setAcpChat). */
  private val saveChat: (String) -> Unit,
  private val hooks: Hooks,
) : AcpAgentHandle {
  /** What the supervisor hears; on the driver's threads. */
  interface Hooks {
    /** Opening failed while the agent runs: the engine cannot work, [reason] for its status. */
    fun onFailed(reason: String)

    /** A turn started or ended: its status changed. */
    fun onBusy(busy: Boolean)

    /** The agent said something: it is in use. */
    fun onHeard()
  }

  private class Running(val done: (AcpTurnEnd) -> Unit)

  private class OpenAsk(val rpcId: Any, val ask: AcpPermissionAsk)

  private val lock = Any()
  private val turn = AcpTurn()
  private val asks = LinkedHashMap<String, OpenAsk>()
  private var running: Running? = null
  private var closed = false

  // Busy before its first turn: its work has not come yet.
  private var waiting = true

  @Volatile private var ready = false

  @Volatile private var chat: String? = null

  @Volatile private var chats: AcpChats? = null

  @Volatile private var before: String? = null

  private val steps: ExecutorService = Executors.newSingleThreadExecutor { r ->
    Thread(r, "phonecando-acp-steps-$agentId").apply { isDaemon = true }
  }

  private val connection = AcpConnection(
    process.input,
    process.output,
    agentId,
    onRequest = ::onRequest,
    onNotification = ::onNotification,
    onClosed = { ready = false },
  )

  /** Where its engine events go while the supervisor listens (EngineStreams.openAcp); null: nowhere. */
  @Volatile var events: ((EngineEvent) -> Unit)? = null

  /** Epoch ms of the last thing the agent sent; null before. What its idle rule reads as output. */
  @Volatile var lastHeardAt: Long? = null
    private set

  /** Initialized, with its chat open. */
  val isReady: Boolean get() = ready

  /** A permission question waits for an answer. */
  val asking: Boolean get() = synchronized(lock) { asks.isNotEmpty() }

  override val chatId: String? get() = chat

  override val chatBefore: String? get() = before

  override val busy: Boolean get() = synchronized(lock) { running != null || waiting }

  override val waitingForWork: Boolean get() = synchronized(lock) { waiting && running == null }

  /** Starts the reader and the opening steps: isReady once done, else hooks.onFailed. */
  fun open() {
    connection.start()
    onSteps {
      try {
        val caps = AcpCaps.of(connection.request(AcpWire.INITIALIZE, AcpWire.initialize(process.setup.clientVersion), INIT_MS))
        if (process.setup.bridge != null && !caps.mcpHttp) {
          Log.w(TAG, "$agentId takes no MCP over HTTP: no phone tools in ACP mode")
        }
        val opener = AcpChats(connection, caps, process.setup) { Log.i(TAG, "$agentId: $it") }
        chats = opener
        val stored = storedChat()
        val ownChat = start?.newChat == true
        if (ownChat) before = opener.before(stored)
        useChat(opener, opener.open(ownChat, stored))
        ready = true
      } catch (e: Exception) {
        // An agent that is gone reports itself: its exit (EngineWatch).
        val gone = (e as? AcpException)?.error?.code == AcpWire.GONE
        if (!gone && !isClosed()) hooks.onFailed(AcpAnswers.failure(e))
      }
    }
  }

  /**
   * The start's task as its first prompt, in the chat open() chose; with
   * none, the wait for its work begins. The supervisor calls it once its
   * events are heard.
   */
  fun begin() {
    val task = start
    if (task == null) {
      AcpTimers.after(WORK_WAIT_MS, Runnable { stopWaiting() })
      return
    }
    if (!prompt(task.prompt, newChat = false, title = null) {}) {
      Log.w(TAG, "first prompt of $agentId not sent")
      stopWaiting()
    }
  }

  override fun prompt(text: String, newChat: Boolean, title: String?, done: (AcpTurnEnd) -> Unit): Boolean {
    synchronized(lock) {
      if (!ready || closed || running != null) return false
      running = Running(done)
      waiting = false
      turn.clear()
    }
    changed(true)
    val queued = onSteps {
      try {
        val opener = checkNotNull(chats)
        if (newChat || chat == null) useChat(opener, opener.createNew())
        send(text, title)
      } catch (e: Exception) {
        endTurn(null, AcpAnswers.failure(e))
      }
    }
    if (!queued) endTurn(null, "the agent is stopping")
    return true
  }

  override fun cancel() {
    val id = chat ?: return
    val open = synchronized(lock) {
      if (running == null) return
      dropAsks()
    }
    // ACP asks a client that cancels to answer its open questions cancelled.
    for (a in open) {
      connection.reply(a.rpcId, AcpWire.permissionCancelled())
      tell { it.onPermissionGone(agentId, a.ask.requestId) }
    }
    connection.notify(AcpWire.CANCEL, AcpWire.cancel(id))
  }

  override fun answerPermission(requestId: String, optionId: String?): Boolean {
    val (open, more) = synchronized(lock) {
      val found = asks[requestId] ?: return false
      if (optionId != null && found.ask.options.none { it.optionId == optionId }) return false
      asks.remove(requestId)
      found to asks.isNotEmpty()
    }
    connection.reply(open.rpcId, if (optionId != null) AcpWire.permissionSelected(optionId) else AcpWire.permissionCancelled())
    if (!more && busy) emit(AcpEvents.answered())
    tell { it.onPermissionGone(agentId, requestId) }
    return true
  }

  override fun snapshot(): AcpSnapshot = synchronized(lock) {
    AcpSnapshot(chat, running != null || waiting, turn.items(), asks.values.firstOrNull()?.ask)
  }

  /** Its engine is going (a stop or its exit): the turn ends with [reason], its questions go, its stdin closes. Once. */
  fun close(reason: String) {
    val (open, waited) = synchronized(lock) {
      if (closed) return
      closed = true
      ready = false
      val was = waiting && running == null
      waiting = false
      dropAsks() to was
    }
    open.forEach { a -> tell { it.onPermissionGone(agentId, a.ask.requestId) } }
    if (waited) changed(false)
    endTurn(null, reason)
    connection.close()
    steps.shutdown()
  }

  // The chat it works in now, with the kind's options, kept as its.
  private fun useChat(opener: AcpChats, opened: AcpChats.Opened) {
    chat = opened.chatId
    opener.applyOptions(opened)
    try {
      saveChat(opened.chatId)
    } catch (e: Exception) {
      Log.w(TAG, "chat of $agentId not kept: ${e.javaClass.simpleName}")
    }
  }

  // The prompt goes out; its answer, whenever it comes, ends the turn.
  private fun send(text: String, title: String?) {
    val id = checkNotNull(chat) { "no chat open" }
    emit(AcpEvents.promptSent())
    title?.let { emit(AcpEvents.title(it)) }
    connection.call(
      AcpWire.PROMPT,
      AcpWire.prompt(id, text),
      0L,
      onResult = { endTurn(AcpAnswers.stopReason(it), null) },
      onError = { endTurn(null, it.message) },
    )
  }

  private fun endTurn(stopReason: String?, error: String?) {
    val (ended, open) = synchronized(lock) {
      val was = running ?: return
      running = null
      was to dropAsks()
    }
    open.forEach { a -> tell { it.onPermissionGone(agentId, a.ask.requestId) } }
    emit(AcpEvents.ended(stopReason, error))
    changed(false)
    val end = AcpTurnEnd(stopReason, error)
    tell { it.onTurnEnd(agentId, end) }
    try {
      ended.done(end)
    } catch (t: Throwable) {
      Log.w(TAG, "turn end of $agentId not handled", t)
    }
  }

  // On the reader thread: a permission question waits for its answer; we offer nothing else.
  private fun onRequest(request: AcpWire.Request) {
    heard()
    if (request.method != AcpWire.REQUEST_PERMISSION) {
      connection.replyError(request.id, AcpWire.METHOD_NOT_FOUND, "not offered by PhoneCanDo")
      return
    }
    val ask = AcpAnswers.permissionAsk("acp-$agentId-${ASKS.incrementAndGet()}", request.params)
    synchronized(lock) { asks[ask.requestId] = OpenAsk(request.id, ask) }
    emit(AcpEvents.asked())
    tell { it.onPermission(agentId, ask) }
  }

  // On the reader thread: only a running turn of its chat shows, as
  // reopening a chat replays its past; a new title shows either way.
  private fun onNotification(notice: AcpWire.Notification) {
    heard()
    if (notice.method != AcpWire.UPDATE) return
    val update = notice.params.optJSONObject("update") ?: return
    if (notice.params.textOf("sessionId") != chat) return
    AcpTurn.titleOf(update)?.let { emit(AcpEvents.title(it)) }
    val item = synchronized(lock) { if (running == null) null else turn.onUpdate(update) } ?: return
    tell { it.onItem(agentId, item) }
  }

  private fun heard() {
    lastHeardAt = System.currentTimeMillis()
    try {
      hooks.onHeard()
    } catch (t: Throwable) {
      Log.w(TAG, "ACP activity not marked", t)
    }
  }

  private fun changed(busy: Boolean) {
    try {
      hooks.onBusy(busy)
    } catch (t: Throwable) {
      Log.w(TAG, "ACP busy not told", t)
    }
    tell { it.onBusy(agentId, busy) }
  }

  // No work came: it is idle now.
  private fun stopWaiting() {
    val idle = synchronized(lock) {
      if (!waiting || closed) return
      waiting = false
      running == null
    }
    if (idle) changed(false)
  }

  // The open questions, removed; under the lock.
  private fun dropAsks(): List<OpenAsk> = asks.values.toList().also { asks.clear() }

  private fun isClosed(): Boolean = synchronized(lock) { closed }

  private fun emit(event: EngineEvent) {
    try {
      events?.invoke(event)
    } catch (t: Throwable) {
      Log.w(TAG, "ACP event not handled", t)
    }
  }

  private fun tell(block: (AcpListener) -> Unit) {
    val listener = AcpEngines.listener ?: return
    try {
      block(listener)
    } catch (t: Throwable) {
      Log.w(TAG, "ACP listener failed", t)
    }
  }

  private fun onSteps(block: () -> Unit): Boolean = try {
    steps.execute { block() }
    true
  } catch (_: RejectedExecutionException) {
    false
  }

  private companion object {
    const val TAG = "PhoneCanDoAcp"
    const val INIT_MS = 90_000L

    // How long a start with no task stays busy after ready, waiting for its work.
    const val WORK_WAIT_MS = 60_000L

    // Permission request ids, unique in the process.
    val ASKS = AtomicLong()
  }
}
