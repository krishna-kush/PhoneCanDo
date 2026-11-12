package com.phonecando.runner.messages

import android.content.Context
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.messages.delivery.InboxFolder
import com.phonecando.runner.messages.delivery.ServerSeat
import com.phonecando.runner.notify.ChatBoard

// The agents as the running app has them: the store's records, the kinds
// (KindCatalogs: label, `inbox.wake`, messaging level; a waiting hook's
// `waiter` file for a kind that wakes through one), each engine's state and chats (the
// supervisor's chat board: waiting when a chat waits for the user, working
// when one runs, else idle) and the screen line of the open bridge. Also
// where a server engine takes its messages (ServerSeat): its port and
// password while it runs, and its working chat, else its latest.
class LiveAgentsView(context: Context) : AgentsView {
  private val app = context.applicationContext ?: context

  override fun all(): List<AgentRecord> = AgentStores.get(app).all()

  override fun kindLabel(kind: String): String = KindCatalogs.get(app).get(kind)?.displayName ?: kind

  override fun kindCanWake(kind: String): Boolean = KindCatalogs.get(app).get(kind)?.canWake == true

  override fun kindLevel(kind: String): MessagingLevel = KindCatalogs.get(app).get(kind)?.messaging ?: MessagingLevel.NONE

  // A kind that wakes through a waiting hook: that hook writes its pid to
  // the inbox folder's `waiter` and removes it when it ends.
  override fun wakeReady(agent: AgentRecord): Boolean {
    val kind = KindCatalogs.get(app).get(agent.kind) ?: return false
    if (!kind.wakeNeedsWaiter) return true
    return InboxFolder.of(ImageDir.of(app.filesDir, agent.imageId).home, agent.id).waiterAlive()
  }

  override fun presence(agentId: String): Presence {
    val engines = Engines.peek() ?: return Presence.STOPPED
    when (engines.status(agentId).state) {
      EngineState.READY -> {}
      EngineState.STARTING -> return Presence(AgentState.STARTING)
      else -> return Presence.STOPPED
    }
    val chats = engines.chatsOf(agentId)
    val state = when {
      chats.any { it.state == ChatBoard.State.WAITING } -> AgentState.WAITING
      chats.any { it.state == ChatBoard.State.WORKING } -> AgentState.WORKING
      else -> AgentState.IDLE
    }
    val latest = engines.latestChat(agentId)
    val chat = chats.firstOrNull { it.state == ChatBoard.State.WORKING } ?: chats.firstOrNull { it.sessionId == latest } ?: chats.firstOrNull()
    return Presence(state, chat?.title)
  }

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
}
