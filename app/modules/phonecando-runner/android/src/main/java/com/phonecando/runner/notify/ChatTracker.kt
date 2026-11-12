package com.phonecando.runner.notify

import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.EngineEvent
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

// Feeds the ChatBoard from the engines' event streams (EngineStreams) and
// reads chat titles from each engine. The stream names a chat only when it
// is created or renamed (a rename updates the board directly), so a title is
// also asked for when a chat first shows, starts a new run and finishes, and
// when a TUI shows a title that fits none of its agent's chats. Reads run on one
// background thread, a short loopback GET each; a failed read keeps the last
// title. onChange runs on that thread or a stream's, never the main thread.
internal class ChatTracker(private val onChange: () -> Unit) {
  private class Source(val kind: AgentKind, val port: String, val password: String)

  private val board = ChatBoard()
  private val sources = ConcurrentHashMap<String, Source>()
  private val reader = Executors.newSingleThreadExecutor { r ->
    Thread(r, "phonecando-chat-titles").apply { isDaemon = true }
  }

  /** The agent's engine is ready on [port]: its titles can be read. */
  fun attach(agentId: String, kind: AgentKind, port: Int, password: String) {
    sources[agentId] = Source(kind, port.toString(), password)
  }

  /** The agent's engine stopped or died: its chats leave the board. */
  fun detach(agentId: String) {
    sources.remove(agentId)
    if (board.drop(agentId)) onChange()
  }

  fun onEvent(agentId: String, event: EngineEvent) {
    val change = board.onEvent(agentId, event, System.currentTimeMillis())
    if (change.changed) onChange()
    change.readTitle?.let { readTitle(agentId, it) }
  }

  /** The chat on screen (JS: useOpenChat by id, useOpenTuiChat by title); nulls for none. */
  fun setOpen(agentId: String?, sessionId: String?, title: String?) {
    if (board.setOpen(agentId, sessionId, title)) onChange()
    // A TUI title that fits no chat: that agent's titles may be newer than ours.
    board.titlesToReread().forEach { (agent, session) -> readTitle(agent, session) }
  }

  /** The user has this agent's chat in front. */
  fun seen(agentId: String) {
    if (board.seen(agentId)) onChange()
  }

  fun chats(): List<ChatBoard.Chat> = board.chats()

  /** The agents with a run going (ChatBoard.working). */
  fun working(): Set<String> = board.working()

  /** The agent's chats, the one on screen included, newest first (ChatBoard.of). */
  fun of(agentId: String): List<ChatBoard.Chat> = board.of(agentId)

  /** The agent's last top-level chat to move (ChatBoard.latest). */
  fun latest(agentId: String): String? = board.latest(agentId)

  private fun readTitle(agentId: String, sessionId: String) {
    val source = sources[agentId] ?: return
    reader.execute {
      val title = runCatching { fetch(source, sessionId) }.getOrNull() ?: return@execute
      if (board.setTitle(agentId, sessionId, title)) onChange()
    }
  }

  private fun fetch(source: Source, sessionId: String): String? {
    val probe = source.kind.sessionInfo(source.port, source.password, sessionId) ?: return null
    val conn = probe.open(CONNECT_MS, READ_MS)
    return try {
      if (conn.responseCode != 200) return null
      source.kind.parseSessionTitle(conn.inputStream.bufferedReader().use { it.readText() })
    } finally {
      conn.disconnect()
    }
  }

  private companion object {
    const val CONNECT_MS = 1_000
    const val READ_MS = 3_000
  }
}
