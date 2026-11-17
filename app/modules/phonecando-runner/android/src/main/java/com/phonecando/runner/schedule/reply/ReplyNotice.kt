package com.phonecando.runner.schedule.reply

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.notify.AppForeground

// A scheduled run's end in a chat: "<agent>: scheduled task done" (or
// "…stopped with an error") with its reply's first line (ReplyText), in
// the agent's slot (AgentNotices.SLOT). The same run's end has just raised
// the agent's "Finished" or "Stopped with an error" alert there
// (notify/AgentAlerts, from the engine's event, before this), so this one
// takes its place, quietly while that one still shows: one notice per run
// end. Posted, as alerts are, only while PhoneCanDo is not in front. Its
// tap opens the agent's Home on that chat.
internal class ReplyNotice(context: Context) {
  private val app = context.applicationContext ?: context
  private val notices = AgentNotices(app)

  fun post(agentId: String, chatId: String?, reply: String?, failed: Boolean) {
    if (AppForeground.isForeground(app)) return
    val name = AgentStores.get(app).get(agentId)?.name ?: return
    notices.post(
      AgentNotices.Notice(
        agentId = agentId,
        id = AgentNotices.SLOT,
        title = ReplyText.title(name, failed),
        text = ReplyText.text(reply),
        quietUpdate = true,
        chatId = chatId,
      ),
    )
  }
}
