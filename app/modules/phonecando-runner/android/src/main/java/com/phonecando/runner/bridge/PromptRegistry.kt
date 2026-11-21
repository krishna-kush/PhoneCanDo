package com.phonecando.runner.bridge

import java.util.UUID

// The prompts the bridge is waiting on, one per request: each /unlock,
// /accessibility or /app-access call registers its own (who is asking and
// why, and for /app-access which app), the app
// shows them one at a time and answers each by its requestId, and the
// request removes its prompt when it returns, timeouts included. Kept in
// memory only: the app reads `pending` on mount and resume, so a prompt
// survives the UI being closed for as long as its request waits. Pure; the
// id source is injected for tests.
class PromptRegistry(private val newId: () -> String = { UUID.randomUUID().toString() }) {
  enum class Kind(val wire: String) { UNLOCK("unlock"), ACCESSIBILITY("accessibility"), APP("app") }

  class Prompt internal constructor(
    val requestId: String,
    val kind: Kind,
    val agentId: String,
    val agentName: String,
    val reason: String,
    /** Creation order; also picks the prompt's notification slot. */
    val seq: Int,
    /** App: the app agents want to use, and its name as the phone shows it. */
    val pkg: String? = null,
    val label: String? = null,
  ) {
    /** Unlock: the app's answer, null while the user decides. */
    @Volatile var answer: Boolean? = null

    // Accessibility: the user opened a step's screen (`guided`: one of the
    // restricted-settings guide's steps), or tapped "Not now".
    @Volatile var opened = false

    @Volatile var guided = false

    @Volatile var cancelled = false

    /** App: the app's answer (APP_ANSWERS), null while the user decides. */
    @Volatile var appAnswer: String? = null

    /** The map the app sees (pendingPrompts and the prompt event); an app prompt adds package and label. */
    fun toMap(): Map<String, Any?> {
      val map = mapOf(
        "requestId" to requestId,
        "kind" to kind.wire,
        "agentId" to agentId,
        "agentName" to agentName,
        "reason" to reason,
      )
      return if (kind == Kind.APP) map + mapOf("package" to pkg, "label" to label) else map
    }
  }

  private val prompts = LinkedHashMap<String, Prompt>()
  private var seq = 0

  @Synchronized
  fun open(
    kind: Kind,
    agentId: String,
    agentName: String,
    reason: String,
    pkg: String? = null,
    label: String? = null,
  ): Prompt {
    val prompt = Prompt(newId(), kind, agentId, agentName, reason, seq++, pkg, label)
    prompts[prompt.requestId] = prompt
    return prompt
  }

  /** Waiting prompts, oldest first. */
  @Synchronized
  fun pending(): List<Prompt> = prompts.values.toList()

  /** The app's answer to one unlock prompt; false when it is gone. */
  @Synchronized
  fun answerUnlock(requestId: String, ok: Boolean): Boolean {
    val prompt = prompts[requestId]?.takeIf { it.kind == Kind.UNLOCK } ?: return false
    if (prompt.answer == null) prompt.answer = ok
    return true
  }

  /** An app prompt still waiting for its answer, for the app to act on before answering. */
  @Synchronized
  fun waitingApp(requestId: String): Prompt? =
    prompts[requestId]?.takeIf { it.kind == Kind.APP && it.appAnswer == null && !it.cancelled }

  // The app's answer to one app prompt: "always", "once" or "no". False
  // when it is gone or the answer is none of those; the first answer stands.
  @Synchronized
  fun answerApp(requestId: String, answer: String): Boolean {
    if (answer !in APP_ANSWERS) return false
    val prompt = prompts[requestId]?.takeIf { it.kind == Kind.APP } ?: return false
    if (prompt.appAnswer == null) prompt.appAnswer = answer
    return true
  }

  // The accessibility dialog reports progress: ok when the user opened a
  // step's screen (the request keeps waiting for the service), not ok when
  // the user tapped "Not now", which ends that request's wait.
  @Synchronized
  fun progressAccessibility(requestId: String, ok: Boolean, guided: Boolean): Boolean {
    val prompt = prompts[requestId]?.takeIf { it.kind == Kind.ACCESSIBILITY } ?: return false
    if (ok) {
      prompt.opened = true
      if (guided) prompt.guided = true
    } else {
      prompt.cancelled = true
    }
    return true
  }

  @Synchronized
  fun close(prompt: Prompt) {
    prompts.remove(prompt.requestId)
  }

  /** The bridge is stopping: end every wait now, as a refusal. */
  @Synchronized
  fun cancelAll() {
    for (prompt in prompts.values) {
      if (prompt.answer == null) prompt.answer = false
      prompt.cancelled = true
    }
  }

  companion object {
    /** An app prompt's answers: saved for every agent, this agent until it hands the phone back, blocked. */
    val APP_ANSWERS = setOf("always", "once", "no")
  }
}
