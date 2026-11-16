package com.phonecando.runner.cutoff

import android.content.Context
import com.phonecando.runner.cutoff.CutOffLook.Why
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.notify.LaunchTarget
import com.phonecando.runner.notify.LaunchTargets

// An agent cut off mid-task: "<agent>: cut off mid-task", what happened and
// what you can do, on the agent channel (notify/AgentNotices), its tap
// opening PhoneCanDo on that agent. Continue (the phone unlocked first)
// brings it back in the same chat; where it cannot go on by itself, Open
// instead. Dismiss, or a swipe, drops the record (CutOffActionReceiver).
// One per agent (a later one replaces it), id ID in the agent's tagged ids.
internal class CutOffNotice(context: Context) {
  private val app = context.applicationContext ?: context
  private val notices = AgentNotices(app)

  /** [canContinue]: Continue, else Open; [ask]: the line after what happened (CutOffText). */
  fun post(agentId: String, name: String, why: Why, chatTitle: String?, canContinue: Boolean, ask: String) {
    val dismiss = CutOffActionReceiver.intent(app, agentId, CutOffActionReceiver.ACTION_DISMISS, why)
    val first = if (canContinue) {
      AgentNotices.NoticeAction(
        CutOffText.CONTINUE_LABEL,
        CutOffActionReceiver.intent(app, agentId, CutOffActionReceiver.ACTION_CONTINUE, why),
        needsUnlock = true,
      )
    } else {
      AgentNotices.NoticeAction(CutOffText.OPEN_LABEL, LaunchTargets.tap(app, LaunchTarget.of("home", agentId)))
    }
    notices.post(
      AgentNotices.Notice(
        agentId = agentId,
        id = ID,
        title = CutOffText.title(name),
        text = CutOffText.text(why, chatTitle, ask),
        longText = true,
        // Again after a tap (it waits, or did not start): no second sound.
        quietUpdate = true,
        actions = listOf(first, AgentNotices.NoticeAction(CutOffText.DISMISS_LABEL, dismiss)),
        deleteIntent = dismiss,
      ),
    )
  }

  fun cancel(agentId: String) = notices.cancel(agentId, ID)

  companion object {
    const val ID = 9470
  }
}
