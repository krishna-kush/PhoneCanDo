package com.phonecando.runner.engine

import java.util.concurrent.ConcurrentHashMap

/** A first prompt for an agent's next engine start: a scheduled task, and whether it wants a chat of its own. */
data class StartPrompt(val prompt: String, val newChat: Boolean)

// The first prompt an agent's next engine start runs (a scheduled task),
// handed from whoever starts it to EngineLauncher.plan(), which takes it:
// the schedule puts it right before it starts the agent, so it rides that
// start only. One per agent, the newest wins. One left untaken that long
// (the start never came, or failed before its plan) is dropped on take, so
// a later start the user makes never runs a stale task. Thread-safe.
object StartPrompts {
  /** How long a put prompt waits for its start. */
  const val MAX_AGE_MS = 2 * 60_000L

  private data class Entry(val prompt: StartPrompt, val at: Long)

  private val entries = ConcurrentHashMap<String, Entry>()

  /** Clock for the age, in ms; monotonic, so a clock change neither keeps nor drops one (entries live as long as the process). */
  internal var now: () -> Long = { System.nanoTime() / 1_000_000 }

  fun put(agentId: String, prompt: String, newChat: Boolean) {
    entries[agentId] = Entry(StartPrompt(prompt, newChat), now())
  }

  /** The agent's prompt, removed; null when there is none, or it waited longer than MAX_AGE_MS. */
  fun take(agentId: String): StartPrompt? {
    val entry = entries.remove(agentId) ?: return null
    return entry.prompt.takeIf { now() - entry.at <= MAX_AGE_MS }
  }
}
