package com.phonecando.runner.schedule

import android.content.Context
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.AppForeground

// An agent as FireRules sees it, read from the running app: its engine
// (Engines; one we asked to start under STARTING_GRACE_MS ago counts as
// starting until it says so) and the mode it runs in, busy or idle (an ACP
// turn running counts as busy) and whether a hook kind's hook waits
// (messages' LiveAgentsView, as a wake would see it), its kind's start
// prompt, wake and ACP mode (KindCatalogs), whether someone has its
// terminal open, the jobs it left running (the work watch's last look) and
// whether PhoneCanDo is in front.
internal class LiveFireState(context: Context) {
  private val app = context.applicationContext ?: context

  fun read(agent: AgentRecord, chat: ChatMode, askedToStartAt: Long?, now: Long): FireRules.State {
    val kind = KindCatalogs.get(app).get(agent.kind)
    val view = Messages.get(app).view
    val presence = view.presence(agent.id)
    val status = Engines.peek()?.status(agent.id)
    val engine = when (status?.state ?: EngineState.STOPPED) {
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
    val look = view.acpLook(agent)
    return FireRules.State(
      engine = engine,
      idle = presence.idle && !look.acpBusy,
      kindPrompts = kind?.promptsAtStart == true,
      kindWakes = kind?.canWake == true,
      wakesByServer = inbox?.wake == InboxWake.SERVER && inbox.server?.wake != null,
      wakeReady = view.wakeReady(agent),
      chat = chat,
      // For a switch to ACP mode, Keep running counts too (as the engine's switch counts it).
      jobs = Engines.work()?.states()?.get(agent.id)?.busy == true || look.jobs,
      appInFront = AppForeground.isForeground(app),
      acp = kind?.speaksAcp == true,
      mode = if (status?.mode == EngineMode.ACP) FireRules.Mode.ACP else FireRules.Mode.TERMINAL,
      viewer = look.viewer,
    )
  }

  /** Whether [kindId] can run scheduled tasks at all (a start prompt, a wake or an ACP mode). */
  fun kindRuns(kindId: String): Boolean = KindCatalogs.get(app).get(kindId)?.runsSchedules == true
}
