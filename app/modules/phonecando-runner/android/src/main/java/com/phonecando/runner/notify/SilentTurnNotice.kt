package com.phonecando.runner.notify

import android.content.Context
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.engine.acp.AcpTurnWatch

// An agent's ACP turn said nothing for AcpTurnWatch.SILENT_MS, so we
// stopped it (EngineSupervisor): one notice in the agent's slot
// (AgentNotices.SLOT, where its alerts go, so it takes the place of the
// "Stopped with an error" alert), posted with PhoneCanDo in front or not,
// since only the agent's own app shows what it waits for. Its tap opens
// the agent's Home, its own app.
internal object SilentTurnNotice {
  fun post(context: Context, agent: AgentRecord?) {
    agent ?: return
    AgentNotices(context.applicationContext ?: context).post(
      AgentNotices.Notice(
        agentId = agent.id,
        id = AgentNotices.SLOT,
        title = agent.name,
        text = AcpTurnWatch.REASON,
        tab = "home",
        longText = true,
      ),
    )
  }
}
