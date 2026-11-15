package com.phonecando.runner.notify

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.checks.CheckChange
import com.phonecando.runner.checks.now.CheckRun

// On the agent channel (AgentNotices), each tap opening that agent's
// checks (LaunchTarget "checks"), worded by CheckLines:
// - a capability's first failure (checks/fanout): "<agent>: <label> isn't
//   working" with why; one per agent and capability (AgentNotices.checkId),
//   so the same one failing again replaces it.
// - a Check now waiting for you in the agent's own app (checks/now, with
//   the app not in front): its tap opens the agent's Home, its own app;
//   gone once the check moves on.
// - a Check now that ended done, stuck or failed (checks/now, with the app
//   not in front): "<agent>: check done" with what it found, or "<agent>:
//   check stopped" with why. The waiting notice and this are one per agent
//   (AgentNotices.CHECK_RUN_ID): the end replaces the wait.
internal class CheckNotices(context: Context) {
  private val app = context.applicationContext ?: context
  private val notices = AgentNotices(app)

  fun post(change: CheckChange) {
    val agent = AgentStores.get(app).get(change.agentId) ?: return
    notices.post(
      AgentNotices.Notice(
        agentId = agent.id,
        id = AgentNotices.checkId(change.capability.ordinal),
        title = CheckLines.title(agent.name, change.capability.wire),
        text = CheckLines.text(change.record.detail),
        tab = LaunchTarget.CHECKS,
        longText = true,
      ),
    )
  }

  fun postWaiting(agentId: String) {
    val agent = AgentStores.get(app).get(agentId) ?: return
    notices.post(
      AgentNotices.Notice(
        agentId = agent.id,
        id = AgentNotices.CHECK_RUN_ID,
        title = CheckLines.waitingTitle(agent.name),
        text = CheckLines.WAITING_TEXT,
        tab = "home",
        longText = true,
      ),
    )
  }

  fun cancelRun(agentId: String) = notices.cancel(agentId, AgentNotices.CHECK_RUN_ID)

  fun postRun(agentId: String, run: CheckRun) {
    if (run.state == CheckRun.State.RUNNING || run.state == CheckRun.State.CANCELLED) return
    val agent = AgentStores.get(app).get(agentId) ?: return
    val done = run.state == CheckRun.State.DONE
    val tally = run.tally()
    notices.post(
      AgentNotices.Notice(
        agentId = agent.id,
        id = AgentNotices.CHECK_RUN_ID,
        title = CheckLines.runTitle(agent.name, done),
        text = if (done) CheckLines.runText(tally.checked, tally.notWorking, tally.unknown) else CheckLines.text(run.detail),
        tab = LaunchTarget.CHECKS,
        longText = !done,
      ),
    )
  }
}
