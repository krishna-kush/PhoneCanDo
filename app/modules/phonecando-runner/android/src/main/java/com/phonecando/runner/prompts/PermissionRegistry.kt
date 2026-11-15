package com.phonecando.runner.prompts

// The questions agents in ACP mode ask before a tool runs
// (session/request_permission), waiting for the user: the app shows each as
// a `permission` prompt beside the bridge's own (pendingPrompts, the
// phonecandoBridgePrompt event) and in the agent's background view, and
// answers it with resolvePermission. Its requestId is the ACP driver's
// (AcpPermissionAsk), unique in the process, so the same id serves the
// prompt, the background view and the answer. The agent waits on the
// answer; a question goes when it is answered, the agent takes it back, its
// turn ends or its engine stops. In memory only. Pure.
class PermissionRegistry {
  /** One answer the agent offers; [kind] is ACP's allow_once, allow_always, reject_once or reject_always. */
  data class Option(val optionId: String, val name: String, val kind: String)

  class Prompt internal constructor(
    val requestId: String,
    val agentId: String,
    val agentName: String,
    /** What it asks to do (the tool call's title). */
    val title: String,
    val toolKind: String?,
    val options: List<Option>,
    /** Creation order; also picks the question's notification slot. */
    val seq: Int,
  ) {
    /** The notification's Allow: the first allow_once answer, else the first allow_*. */
    val allow: Option? get() = options.firstOrNull { it.kind == ALLOW_ONCE } ?: options.firstOrNull { it.kind.startsWith(ALLOW) }

    /** The notification's Deny: the first reject_* answer; null: Deny cancels the question. */
    val deny: Option? get() = options.firstOrNull { it.kind.startsWith(REJECT) }

    /** [optionId] is one of its answers, or null (cancel it). */
    fun accepts(optionId: String?): Boolean = optionId == null || options.any { it.optionId == optionId }

    /** The map the app sees: the bridge prompts' shape plus the question. */
    fun toMap(): Map<String, Any?> = mapOf(
      "requestId" to requestId,
      "kind" to KIND,
      "agentId" to agentId,
      "agentName" to agentName,
      "reason" to KIND,
      "title" to title,
      "toolKind" to toolKind,
      "options" to options.map { mapOf("optionId" to it.optionId, "name" to it.name, "kind" to it.kind) },
    )
  }

  /** What one [open] did: the new prompt, and the one with the same id it replaced. */
  data class Opened(val prompt: Prompt, val replaced: Prompt?)

  private val prompts = LinkedHashMap<String, Prompt>()
  private var seq = 0

  @Synchronized
  fun open(requestId: String, agentId: String, agentName: String, title: String, toolKind: String?, options: List<Option>): Opened {
    val replaced = prompts.remove(requestId)
    val prompt = Prompt(requestId, agentId, agentName, title, toolKind, options, seq++)
    prompts[requestId] = prompt
    return Opened(prompt, replaced)
  }

  /** Waiting questions, oldest first. */
  @Synchronized
  fun pending(): List<Prompt> = prompts.values.toList()

  @Synchronized
  fun get(requestId: String): Prompt? = prompts[requestId]

  /** Answered, taken back or gone with its turn: it goes; null when it was gone already. */
  @Synchronized
  fun remove(requestId: String): Prompt? = prompts.remove(requestId)

  /** The agent's turn ended or its engine stopped: its questions go. */
  @Synchronized
  fun drop(agentId: String): List<Prompt> {
    val gone = prompts.values.filter { it.agentId == agentId }
    gone.forEach { prompts.remove(it.requestId) }
    return gone
  }

  companion object {
    const val KIND = "permission"
    const val ALLOW = "allow"
    const val ALLOW_ONCE = "allow_once"
    const val REJECT = "reject"
  }
}
