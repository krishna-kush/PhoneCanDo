package com.phonecando.runner.notify

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.EngineEvent.Kind

// The chats the running engines are busy with, for the service notification
// (ServiceNotification): each chat an event stream has seen move, with its
// state and title. Pure; EngineChats feeds it and fetches the titles.
// - A top-level chat shows from its first activity: working, waiting for
//   your answer, then done or stopped with an error. Done and error stay
//   until the user opens that agent's chat (seen) or its engine goes.
// - A subagent's child session shows only while it waits for your answer
//   (that holds up its parent); its other moves belong to the parent's run.
// - A run the user stopped, and a deleted session, leave the board.
// - At most [maxEnded] done/error chats stay; the oldest go first.
// - The chat on screen (setOpen) is left out: you are in it. A run that
//   ends while it is open counts as seen, and opening a done or error chat
//   is seeing it, so neither shows as done after you leave. The web UI names
//   it by id; a TUI only by the title it shows (cut to 37 characters and
//   "…" past 40), which counts only when exactly one of that agent's chats
//   has it, so a fresh untitled chat or two alike stay listed.
// - Each agent's last top-level chat to move (latest) is kept while its
//   engine runs, whatever the board shows: where other agents' messages go
//   for a server engine (messages/).
class ChatBoard(private val maxEnded: Int = MAX_ENDED, private val maxChildren: Int = MAX_CHILDREN) {
  /** In the order the notification lists them. */
  enum class State(val label: String) {
    WAITING("Waiting for your answer"),
    WORKING("Working"),
    FAILED("Stopped with an error"),
    DONE("Done"),
  }

  data class Chat(
    val agentId: String,
    val sessionId: String,
    val state: State,
    val title: String?,
    /** When the state last changed; newer first within a state. */
    val at: Long,
  )

  /** What an event did: whether the board changed, and a chat whose title to (re)read. */
  data class Change(val changed: Boolean, val readTitle: String? = null)

  private val chats = LinkedHashMap<String, Chat>()
  private val children = HashMap<String, LinkedHashSet<String>>()
  private data class Open(val agentId: String, val sessionId: String?, val title: String?)

  private var open: Open? = null

  // Per agent, its last top-level chat that moved.
  private val last = HashMap<String, String>()

  @Synchronized
  fun onEvent(agentId: String, event: EngineEvent, now: Long): Change {
    val session = event.sessionId ?: return NONE
    event.title?.let { return Change(applyTitle(agentId, session, it)) }
    val kids = children.getOrPut(agentId) { LinkedHashSet() }
    if (event.childCreated) {
      kids += session
      if (kids.size > maxChildren) kids.remove(kids.first())
      return NONE
    }
    val key = key(agentId, session)
    val current = chats[key]
    val child = session in kids
    if (!child && event.kind != Kind.OTHER) {
      if (event.kind == Kind.GONE) last.remove(agentId, session) else last[agentId] = session
    }
    val next = when (event.kind) {
      Kind.WAITING -> State.WAITING
      Kind.WORKING -> if (child) null else State.WORKING
      Kind.FINISHED -> if (child) null else State.DONE
      Kind.FAILED -> if (child) null else State.FAILED
      Kind.STOPPED, Kind.GONE -> null
      Kind.OTHER -> return NONE
    }
    if (next == null) {
      if (event.kind == Kind.GONE) kids -= session
      return Change(chats.remove(key) != null)
    }
    if (current?.state == next) return NONE
    if (key == openKey() && (next == State.DONE || next == State.FAILED)) {
      chats.remove(key)
      return NONE
    }
    chats[key] = Chat(agentId, session, next, current?.title, now)
    trimEnded()
    // A new run may follow a rename, and a finished run's title is final.
    val reread = current == null || next == State.DONE || (next == State.WORKING && current.state != State.WAITING)
    return Change(true, session.takeIf { reread })
  }

  /** A title read from the engine; true when it changed what shows. */
  @Synchronized
  fun setTitle(agentId: String, sessionId: String, title: String): Boolean = applyTitle(agentId, sessionId, title)

  /**
   * The chats whose titles to read again: those of the agent a TUI shows,
   * when its title fits none of them (the chat was named after the board
   * last read its title). Empty otherwise.
   */
  @Synchronized
  fun titlesToReread(): List<Pair<String, String>> {
    val o = open ?: return emptyList()
    if (o.title == null || openKey() != null) return emptyList()
    return chats.values.filter { it.agentId == o.agentId && it.title != o.title }.map { it.agentId to it.sessionId }
  }

  /** The chat on screen by id, or by the title a TUI shows; nulls for none. True when that changed. */
  @Synchronized
  fun setOpen(agentId: String?, sessionId: String?, title: String? = null): Boolean {
    val next = agentId?.takeIf { sessionId != null || !title.isNullOrBlank() }
      ?.let { Open(it, sessionId, title?.trim()) }
    if (next == open) return false
    open = next
    seeOpenIfEnded()
    return true
  }

  /** The user opened this agent's chat: its done and error chats go. */
  @Synchronized
  fun seen(agentId: String): Boolean =
    chats.values.removeAll { it.agentId == agentId && (it.state == State.DONE || it.state == State.FAILED) }

  /** The agent's engine is gone: so is everything it was doing. */
  @Synchronized
  fun drop(agentId: String): Boolean {
    children.remove(agentId)
    last.remove(agentId)
    return chats.values.removeAll { it.agentId == agentId }
  }

  /** The agents with a run going: a working chat, the one on screen included. */
  @Synchronized
  fun working(): Set<String> = chats.values.filter { it.state == State.WORKING }.mapTo(HashSet()) { it.agentId }

  /** The agent's chats, the one on screen included, newest first. */
  @Synchronized
  fun of(agentId: String): List<Chat> = chats.values.filter { it.agentId == agentId }.sortedByDescending { it.at }

  /** The agent's last top-level chat to move while its engine runs; null for none. */
  @Synchronized
  fun latest(agentId: String): String? = last[agentId]

  /** Waiting first, then working, error, done; newest first within each. */
  @Synchronized
  fun chats(): List<Chat> {
    val hidden = openKey()
    return chats.values
      .filter { key(it.agentId, it.sessionId) != hidden }
      .sortedWith(compareBy<Chat>({ it.state.ordinal }, { -it.at }))
  }

  private fun applyTitle(agentId: String, sessionId: String, title: String): Boolean {
    val key = key(agentId, sessionId)
    val chat = chats[key] ?: return false
    if (title.isBlank() || chat.title == title) return false
    chats[key] = chat.copy(title = title)
    // A title can make an ended chat the open one: seeing it.
    seeOpenIfEnded()
    return true
  }

  // Opening a done or error chat is seeing it.
  private fun seeOpenIfEnded() {
    val key = openKey() ?: return
    val chat = chats[key] ?: return
    if (chat.state == State.DONE || chat.state == State.FAILED) chats.remove(key)
  }

  // The open chat's key: by id, or the one chat of that agent the title fits.
  private fun openKey(): String? {
    val o = open ?: return null
    if (o.sessionId != null) return key(o.agentId, o.sessionId)
    val shown = o.title ?: return null
    val fits = chats.values.filter { it.agentId == o.agentId && it.title != null && titleFits(it.title, shown) }
    return fits.singleOrNull()?.let { key(it.agentId, it.sessionId) }
  }

  private fun titleFits(title: String, shown: String): Boolean =
    if (shown.endsWith("…")) title.startsWith(shown.dropLast(1)) else title == shown

  private fun trimEnded() {
    val ended = chats.values.filter { it.state == State.DONE || it.state == State.FAILED }.sortedBy { it.at }
    ended.take((ended.size - maxEnded).coerceAtLeast(0)).forEach { chats.remove(key(it.agentId, it.sessionId)) }
  }

  private fun key(agentId: String, sessionId: String) = "$agentId $sessionId"

  private companion object {
    val NONE = Change(false)
    const val MAX_ENDED = 4
    const val MAX_CHILDREN = 256
  }
}
