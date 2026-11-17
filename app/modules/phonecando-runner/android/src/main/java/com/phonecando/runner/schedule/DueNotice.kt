package com.phonecando.runner.schedule

import android.content.Context
import com.phonecando.runner.notify.AgentNotices

// A task that could not run on its own: "<agent>: scheduled task due",
// with the task's line and why (DueText), on the agent channel
// (notify/AgentNotices), whose tap opens PhoneCanDo on that agent. With
// [runScheduleId] (AskReasons.tapRuns) the tap also runs that schedule now
// (notify/OpenTargetActivity → Schedules.runNow). One per agent (a later
// one replaces it), id DUE_ID in the agent's tagged ids (beside SLOT,
// /notify, prompts and links, which end at 9363).
internal class DueNotice(context: Context) {
  private val notices = AgentNotices(context.applicationContext ?: context)

  fun post(agentId: String, agentName: String, task: String, why: String?, runScheduleId: String?) {
    notices.post(
      AgentNotices.Notice(
        agentId = agentId,
        id = DUE_ID,
        title = DueText.title(agentName),
        text = DueText.text(task, why, tapRuns = runScheduleId != null),
        longText = true,
        runSchedule = runScheduleId,
      ),
    )
  }

  companion object {
    const val DUE_ID = 9400
  }
}
