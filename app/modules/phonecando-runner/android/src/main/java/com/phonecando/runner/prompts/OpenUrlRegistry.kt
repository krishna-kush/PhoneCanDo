package com.phonecando.runner.prompts

import java.util.UUID

// The links agents asked the phone to open (`phonecando-open`), waiting for
// the user: the app shows each as an `open_url` prompt beside the bridge's
// own (pendingPrompts, the phonecandoBridgePrompt event) and ends it with
// resolveOpenUrl. Nothing waits on the answer: the agent's script returned
// when it wrote the line. The same link from the same agent while one is
// waiting adds nothing, an agent keeps at most MAX_PER_AGENT (a new one
// pushes out its oldest), and an agent's links go when its engine stops.
// In memory only. Pure; the id source is injected for tests.
class OpenUrlRegistry(private val newId: () -> String = { UUID.randomUUID().toString() }) {
  class Prompt internal constructor(
    val requestId: String,
    val agentId: String,
    val agentName: String,
    val url: String,
    val host: String,
    /** Creation order; also picks the prompt's notification slot. */
    val seq: Int,
  ) {
    /** The map the app sees, the bridge prompts' shape plus the link. */
    fun toMap(): Map<String, Any?> = mapOf(
      "requestId" to requestId,
      "kind" to KIND,
      "agentId" to agentId,
      "agentName" to agentName,
      "reason" to KIND,
      "url" to url,
    )
  }

  /** What one [open] did: the new prompt, and the older one it pushed out. */
  data class Opened(val prompt: Prompt, val pushedOut: Prompt?)

  private val prompts = LinkedHashMap<String, Prompt>()
  private var seq = 0

  /** Null when [url] is not one we open, or this agent already waits on it. */
  @Synchronized
  fun open(agentId: String, agentName: String, url: String): Opened? {
    val host = OpenUrl.hostOf(url) ?: return null
    val mine = prompts.values.filter { it.agentId == agentId }
    if (mine.any { it.url == url }) return null
    val pushedOut = mine.takeIf { it.size >= MAX_PER_AGENT }?.first()?.also { prompts.remove(it.requestId) }
    val prompt = Prompt(newId(), agentId, agentName, url, host, seq++)
    prompts[prompt.requestId] = prompt
    return Opened(prompt, pushedOut)
  }

  /** Waiting links, oldest first. */
  @Synchronized
  fun pending(): List<Prompt> = prompts.values.toList()

  /** The user is done with it; null when it is gone. */
  @Synchronized
  fun resolve(requestId: String): Prompt? = prompts.remove(requestId)

  /** The agent's engine stopped: its links go. */
  @Synchronized
  fun drop(agentId: String): List<Prompt> {
    val gone = prompts.values.filter { it.agentId == agentId }
    gone.forEach { prompts.remove(it.requestId) }
    return gone
  }

  companion object {
    const val KIND = "open_url"
    const val MAX_PER_AGENT = 4
    const val COPY = "copy"

    /** What the user did, as the app reports it (resolveOpenUrl). */
    val ACTIONS = setOf("open", COPY, "dismiss")
  }
}
