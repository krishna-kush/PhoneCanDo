package com.phonecando.runner.prompts

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import com.phonecando.runner.PhoneCanDoRunnerModule
import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.notify.AppForeground

// How an agent's link reaches the user: the app's prompt event, and while
// PhoneCanDo is not in front a notification of its own ("Wants to open
// <host>. Tap to review."), whose tap opens the agent's Home, where the app
// shows the prompt; it is taken down when the prompt ends. We never open
// the link ourselves: the user does, from the prompt (or has us copy it).
// One registry per process, read by pendingPrompts whether or not the app
// was open.
internal object OpenUrlPrompts {
  private const val TAG = "PhoneCanDoOpenUrl"

  val registry = OpenUrlRegistry()

  fun pending(): List<Map<String, Any?>> = registry.pending().map { it.toMap() }

  /** The agent wrote `@open <url>` to its events file. */
  fun raise(context: Context, agents: AgentDirectory, agentId: String, url: String) {
    val name = agents.get(agentId)?.name ?: return
    val opened = registry.open(agentId, name, url) ?: return
    val notices = AgentNotices(context)
    opened.pushedOut?.let { withdraw(notices, it) }
    PhoneCanDoRunnerModule.emitBridgePrompt(opened.prompt.toMap())
    if (AppForeground.isForeground(context)) return
    val prompt = opened.prompt
    notices.post(
      AgentNotices.Notice(
        prompt.agentId, AgentNotices.openUrlId(prompt.seq), prompt.agentName,
        "Wants to open ${prompt.host}. Tap to review.",
        icon = android.R.drawable.ic_menu_view,
      ),
    )
  }

  /**
   * The user is done with the link: opened it (the app did), had us copy
   * it, or dismissed it. False when the prompt is gone, or a copy did not
   * reach the clipboard.
   */
  fun resolve(context: Context, requestId: String, action: String): Boolean {
    require(action in OpenUrlRegistry.ACTIONS) { "unknown action $action" }
    val prompt = registry.resolve(requestId) ?: return false
    withdraw(AgentNotices(context), prompt)
    if (action != OpenUrlRegistry.COPY) return true
    return try {
      val cm = context.getSystemService(ClipboardManager::class.java) ?: return false
      cm.setPrimaryClip(ClipData.newPlainText(prompt.host, prompt.url))
      true
    } catch (e: Exception) {
      Log.w(TAG, "link not copied", e)
      false
    }
  }

  /** The agent's engine stopped: its links and their notifications go. */
  fun end(context: Context, agentId: String) {
    val gone = registry.drop(agentId)
    if (gone.isEmpty()) return
    val notices = AgentNotices(context)
    gone.forEach { withdraw(notices, it) }
  }

  private fun withdraw(notices: AgentNotices, prompt: OpenUrlRegistry.Prompt) {
    notices.cancel(prompt.agentId, AgentNotices.openUrlId(prompt.seq))
  }
}
