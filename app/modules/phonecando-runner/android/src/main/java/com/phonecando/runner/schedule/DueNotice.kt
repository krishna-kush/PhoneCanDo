package com.phonecando.runner.schedule

import android.content.Context
import com.phonecando.runner.messages.MessageText
import com.phonecando.runner.notify.AgentNotices

// A task that could not run on its own: "<agent>: scheduled task due",
// with the task's first line, on the agent channel (notify/AgentNotices),
// whose tap opens PhoneCanDo on that agent. One per agent (a later one
// replaces it), id DUE_ID in the agent's tagged ids (beside SLOT, /notify,
// prompts and links, which end at 9363).
internal class DueNotice(context: Context) {
  private val notices = AgentNotices(context.applicationContext ?: context)

  fun post(agentId: String, agentName: String, text: String) {
    notices.post(
      AgentNotices.Notice(
        agentId = agentId,
        id = DUE_ID,
        title = "$agentName: scheduled task due",
        text = MessageText.oneLine(text, TEXT_MAX),
      ),
    )
  }

  companion object {
    const val DUE_ID = 9400
    private const val TEXT_MAX = 120
  }
}
