package com.phonecando.runner.schedule

import android.content.Context
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.AppForeground

// An agent as FireRules sees it, read from the running app: its engine
// (Engines; one we asked to start under STARTING_GRACE_MS ago counts as
// starting until it says so), busy or idle and whether a hook kind's hook
// waits (messages' LiveAgentsView, as a wake would see it), its kind's
// start prompt and wake (KindCatalogs), the jobs it left running (the work
// watch's last look) and whether PhoneCanDo is in front.
internal class LiveFireState(context: Context) {
  private val app = context.applicationContext ?: context

  fun read(agent: AgentRecord, chat: ChatMode, askedToStartAt: Long?, now: Long): FireRules.State {
    val kind = KindCatalogs.get(app).get(agent.kind)
    val view = Messages.get(app).view
    val presence = view.presence(agent.id)
    val state = Engines.peek()?.status(agent.id)?.state ?: EngineState.STOPPED
    val engine = when (state) {
      EngineState.READY -> FireRules.Engine.READY
      EngineState.STARTING -> FireRules.Engine.STARTING
      EngineState.STOPPING -> FireRules.Engine.STOPPING
      else -> if (askedToStartAt != null && now - askedToStartAt < ScheduleRules.STARTING_GRACE_MS) {
        FireRules.Engine.STARTING
      } else {
        FireRules.Engine.STOPPED
      }
    }
    val inbox = kind?.inbox
    return FireRules.State(
      engine = engine,
      idle = presence.idle,
      kindPrompts = kind?.promptsAtStart == true,
      kindWakes = kind?.canWake == true,
      wakesByServer = inbox?.wake == InboxWake.SERVER && inbox.server?.wake != null,
      wakeReady = view.wakeReady(agent),
      chat = chat,
      jobs = Engines.work()?.states()?.get(agent.id)?.busy == true,
      appInFront = AppForeground.isForeground(app),
    )
  }

  /** Whether [kindId] can run scheduled tasks at all (a start prompt or a wake). */
  fun kindRuns(kindId: String): Boolean = KindCatalogs.get(app).get(kindId)?.runsSchedules == true
}
