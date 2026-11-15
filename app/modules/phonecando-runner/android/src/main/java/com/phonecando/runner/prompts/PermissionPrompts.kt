package com.phonecando.runner.prompts

import android.content.Context
import android.util.Log
import com.phonecando.runner.PhoneCanDoRunnerModule
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.acp.AcpPermissionAsk
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.notify.AppForeground

// How an agent's permission question in ACP mode reaches the user: the
// app's prompt event (a `permission` prompt, kept for pendingPrompts) and,
// while PhoneCanDo is not in front, a notification of its own ("Asks for
// your OK: <what>") with Allow and Deny, whose tap opens the agent's Home.
// Allow sends the first allow_once answer, else the first allow_*; it asks
// for the phone to be unlocked first (Android 12+). Deny sends the first
// reject_* answer, else cancels the question. The app answers with
// resolvePermission (any answer the agent offered), the buttons through
// PermissionActionReceiver. The question and its notification go when it
// is answered, the agent takes it back, its turn ends or its engine stops.
// [onAsk] and [onGone] tell the app's ACP view (acp/AcpRelay sets them).
// One registry per process.
internal object PermissionPrompts {
  private const val TAG = "PhoneCanDoPermission"

  val registry = PermissionRegistry()

  /** A question opened: the agent's id and the question (AcpPermissionAsk.toMap). */
  @Volatile var onAsk: (String, Map<String, Any?>) -> Unit = { _, _ -> }

  /** A question went: the agent's id and the question's id. */
  @Volatile var onGone: (String, String) -> Unit = { _, _ -> }

  fun pending(): List<Map<String, Any?>> = registry.pending().map { it.toMap() }

  /** The agent in ACP mode asks before a tool runs. */
  fun raise(context: Context, agentId: String, ask: AcpPermissionAsk) {
    val name = AgentStores.get(context).get(agentId)?.name ?: return
    val options = ask.options.map { PermissionRegistry.Option(it.optionId, it.name, it.kind) }
    val opened = registry.open(ask.requestId, agentId, name, ask.title, ask.toolKind, options)
    val notices = AgentNotices(context)
    opened.replaced?.let { withdraw(notices, it) }
    val prompt = opened.prompt
    PhoneCanDoRunnerModule.emitBridgePrompt(prompt.toMap())
    onAsk(agentId, ask.toMap())
    if (AppForeground.isForeground(context)) return
    val noticeId = AgentNotices.permissionId(prompt.seq)
    val buttons = listOfNotNull(
      prompt.allow?.let {
        AgentNotices.NoticeAction("Allow", PermissionActionReceiver.intent(context, prompt, it.optionId, noticeId), needsUnlock = true)
      },
      AgentNotices.NoticeAction("Deny", PermissionActionReceiver.intent(context, prompt, prompt.deny?.optionId, noticeId)),
    )
    notices.post(AgentNotices.Notice(prompt.agentId, noticeId, prompt.agentName, "Asks for your OK: ${prompt.title}", actions = buttons))
  }

  /**
   * The user answered (the app, or a notification button): [optionId] one
   * of the answers the agent offered, null to cancel the question. False
   * when the question is gone, the answer is not one it offered, or the
   * agent did not take it.
   */
  fun resolve(context: Context, requestId: String, optionId: String?): Boolean {
    val prompt = registry.get(requestId) ?: return false
    if (!prompt.accepts(optionId)) return false
    registry.remove(requestId)
    withdraw(AgentNotices(context), prompt)
    onGone(prompt.agentId, requestId)
    return try {
      AcpEngines.of(prompt.agentId)?.answerPermission(requestId, optionId) == true
    } catch (e: Exception) {
      Log.w(TAG, "answer not sent", e)
      false
    }
  }

  /** The question was answered, cancelled, or went with its turn or engine (AcpListener.onPermissionGone). */
  fun gone(context: Context, agentId: String, requestId: String) {
    registry.remove(requestId)?.let { withdraw(AgentNotices(context), it) }
    onGone(agentId, requestId)
  }

  /** The agent's turn ended or its engine stopped: its questions and their notifications go. */
  fun end(context: Context, agentId: String) {
    val gone = registry.drop(agentId)
    if (gone.isEmpty()) return
    val notices = AgentNotices(context)
    for (prompt in gone) {
      withdraw(notices, prompt)
      onGone(agentId, prompt.requestId)
    }
  }

  private fun withdraw(notices: AgentNotices, prompt: PermissionRegistry.Prompt) {
    notices.cancel(prompt.agentId, AgentNotices.permissionId(prompt.seq))
  }
}
