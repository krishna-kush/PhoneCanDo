package com.phonecando.runner.presence

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.cutoff.BringKinds
import com.phonecando.runner.cutoff.BringRules
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.acp.AcpListing
import com.phonecando.runner.engine.starts.EngineStarts
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.schedule.ChatMode
import com.phonecando.runner.schedule.FireRules
import com.phonecando.runner.schedule.LiveFireState

// The note that sends an agent on after a hand-over (HandsText.resume).
// A running engine gets it as a runner notice that wakes it past its
// wake switch, budget and hop, as a scheduled task's does (a resume is
// yours); one idle in a TUI that nothing wakes is started again in the
// same chat with the note as its first prompt, or, when its TUI takes no
// first prompt, started in ACP mode with it in the chat its terminal left
// (ResumeRules). A stopped
// one is brought back the way a run cut off is (cutoff/BringRules), in
// the chat it was in when the hand-over began
// ([Spot]): an ACP chat or a TUI that resumes starts with the note as its
// first prompt; a server that wakes through its server starts, and the
// note wakes it once it is ready; any other kind finds the note when it
// next runs.
internal class Resume(context: Context) {
  private val app = context.applicationContext ?: context

  /** Where the agent was when the hand-over began: its engine's mode and its chat. */
  data class Spot(val mode: EngineMode, val chat: String?)

  /** [agentId]'s mode and chat now. */
  fun spot(agentId: String): Spot {
    val engines = Engines.peek() ?: return Spot(EngineMode.TERMINAL, null)
    val chats = engines.chatsOf(agentId)
    val chat = AcpEngines.of(agentId)?.chatId
      ?: chats.firstOrNull { it.state == ChatBoard.State.WORKING || it.state == ChatBoard.State.WAITING }?.sessionId
      ?: engines.latestChat(agentId)
    return Spot(engines.status(agentId).mode, chat)
  }

  fun send(agentId: String, after: HandMode, spot: Spot?) {
    val text = HandsText.resume(after)
    val mailbox = Messages.get(app).mailbox
    val agents = AgentStores.get(app)
    if (Engines.peek()?.status(agentId)?.state?.live == true) {
      val agent = agents.get(agentId)
      val starts = EngineStarts(app)
      val refused = when (agent?.let { ResumeRules.decide(look(it)) }) {
        ResumeRules.Way.RESTART -> {
          starts.stop(agentId)
          starts.start(agentId, text, newChat = false, sameChat = true) ?: return
        }
        ResumeRules.Way.SWITCH -> {
          starts.stop(agentId)
          starts.start(agentId, text, newChat = false, mode = EngineMode.ACP, sameChat = true) ?: return
        }
        ResumeRules.Way.WAIT -> {
          mailbox.notice(agentId, text, wake = false, resume = true)
          return
        }
        else -> null
      }
      if (refused != null) Log.i(TAG, "start of $agentId to go on refused: $refused")
      mailbox.notice(agentId, text, wake = true, resume = true)
      return
    }
    val agent = agents.get(agentId) ?: return
    val at = spot ?: Spot(EngineMode.TERMINAL, null)
    val starts = EngineStarts(app)
    val refused = when (BringRules.plan(at.mode, BringKinds.of(app, agent), listOf(at.chat))) {
      BringRules.Plan.START_ACP -> {
        val chat = at.chat!!
        if (agent.acpChat != chat) agents.setAcpChat(agentId, chat)
        starts.start(agentId, text, newChat = false, mode = EngineMode.ACP, sameChat = true)
      }
      BringRules.Plan.START_WITH_PROMPT -> starts.start(agentId, text, newChat = false, sameChat = true)
      BringRules.Plan.START_THEN_POST -> starts.start(agentId) ?: run {
        mailbox.notice(agentId, text, wake = true, resume = true)
        return
      }
      BringRules.Plan.OPEN -> NOT_BROUGHT
    }
    if (refused != null) {
      // It reads the note when it next runs.
      Log.i(TAG, "resume of $agentId waits for its next run: $refused")
      mailbox.notice(agentId, text, wake = false, resume = true)
    }
  }

  // The agent as ResumeRules sees it, read as a scheduled task's run reads it.
  private fun look(agent: AgentRecord): ResumeRules.State {
    val s = LiveFireState(app).read(agent, ChatMode.SAME, null, System.currentTimeMillis())
    val kind = BringKinds.of(app, agent)
    return ResumeRules.State(
      ready = s.engine == FireRules.Engine.READY,
      idle = s.idle,
      acpMode = s.mode == FireRules.Mode.ACP,
      // Its kind's own wake only: an ACP kind's wakeReady also counts a switch to ACP mode.
      kindWakes = s.kindWakes && s.wakeReady,
      jobs = s.jobs,
      restartable = kind?.prompts == true && kind.resumes,
      acpKind = s.acp,
      acpLists = AcpListing.lists(app, agent.kind),
    )
  }

  private companion object {
    const val TAG = "PhoneCanDoPresence"
    const val NOT_BROUGHT = "its kind cannot go on by itself"
  }
}
