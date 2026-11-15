package com.phonecando.runner.prompts

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.phonecando.runner.notify.AgentNotices

// Where a permission notification's Allow and Deny land (PermissionPrompts),
// in our process: the answer goes to the agent and the notification comes
// down, also when the question is already gone (the engine stopped, the
// app answered it). Not exported: only our own PendingIntents send it, each
// with its own identifier, so one question's buttons never carry another's.
class PermissionActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION) return
    val requestId = intent.getStringExtra(EXTRA_REQUEST) ?: return
    PermissionPrompts.resolve(context, requestId, intent.getStringExtra(EXTRA_OPTION))
    val agentId = intent.getStringExtra(EXTRA_AGENT) ?: return
    val noticeId = intent.getIntExtra(EXTRA_NOTICE, -1)
    if (noticeId >= 0) AgentNotices(context).cancel(agentId, noticeId)
  }

  companion object {
    const val ACTION = "com.phonecando.runner.PERMISSION_ANSWER"
    private const val EXTRA_REQUEST = "requestId"
    private const val EXTRA_OPTION = "optionId"
    private const val EXTRA_AGENT = "agentId"
    private const val EXTRA_NOTICE = "noticeId"

    /** A button's intent: [optionId] the answer it sends, null to cancel the question. */
    internal fun intent(context: Context, prompt: PermissionRegistry.Prompt, optionId: String?, noticeId: Int): PendingIntent {
      val i = Intent(context, PermissionActionReceiver::class.java)
        .setAction(ACTION)
        .setIdentifier("permission|${prompt.requestId}|${optionId.orEmpty()}")
        .putExtra(EXTRA_REQUEST, prompt.requestId)
        .putExtra(EXTRA_AGENT, prompt.agentId)
        .putExtra(EXTRA_NOTICE, noticeId)
      optionId?.let { i.putExtra(EXTRA_OPTION, it) }
      return PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}
