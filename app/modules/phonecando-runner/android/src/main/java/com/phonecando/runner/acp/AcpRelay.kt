package com.phonecando.runner.acp

import android.content.Context
import android.util.Log
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.engine.acp.AcpItem
import com.phonecando.runner.engine.acp.AcpListener
import com.phonecando.runner.engine.acp.AcpPermissionAsk
import com.phonecando.runner.engine.acp.AcpTurnEnd
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.prompts.PermissionPrompts
import com.phonecando.runner.schedule.Schedules

// The runner's one ACP listener (engine/acp AcpEngines.listener), outside
// the engine: what an agent's ACP turn does goes on from here.
// - items, busy and the turn's end: to the app (AcpAppEvents);
// - a permission question: PermissionPrompts (the app's prompt, a
//   notification with Allow and Deny); it goes when the agent takes it
//   back, the turn ends or the engine stops. While a Check now runs for the
//   agent (checks/now), it is rejected at once instead, with no prompt;
// - the turn's end: Schedules (a task's turn that ended badly fails its
//   run) and the capability checks (checks/: an end_turn is a turn end);
//   no turn running: Messages (a waiting set may go in now).
// Set once per process (install), when messaging is first made (every
// engine start makes it first) or the app's module is. Its calls come on
// the ACP driver's threads: each is guarded, so nothing here can break one.
internal class AcpRelay private constructor(private val app: Context) : AcpListener {
  override fun onItem(agentId: String, item: AcpItem) = guarded { AcpAppEvents.item(agentId, item) }

  override fun onPermission(agentId: String, ask: AcpPermissionAsk) = guarded {
    if (!CheckNow.rejects(agentId, ask)) PermissionPrompts.raise(app, agentId, ask)
  }

  override fun onPermissionGone(agentId: String, requestId: String) = guarded { PermissionPrompts.gone(app, agentId, requestId) }

  override fun onTurnEnd(agentId: String, end: AcpTurnEnd) = guarded {
    Checks.acpTurnEnded(agentId, end.stopReason, end.error)
    PermissionPrompts.end(app, agentId)
    AcpAppEvents.turnEnd(agentId, end)
    Schedules.peek()?.acpTurnEnded(agentId, end.stopReason, end.error)
  }

  override fun onBusy(agentId: String, busy: Boolean) = guarded {
    AcpAppEvents.busy(agentId, busy)
    if (!busy) Messages.peek()?.acpIdle(agentId)
  }

  // An engine that stops, dies or fails takes its questions with it.
  private val engines = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      if (!status.state.live) guarded { PermissionPrompts.end(app, status.agentId) }
    }
  }

  private inline fun guarded(block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      Log.w(TAG, "ACP listener failed", e)
    }
  }

  companion object {
    private const val TAG = "PhoneCanDoAcp"

    @Volatile private var installed = false

    /** Sets the one listener and the permission hooks; later calls do nothing. */
    fun install(context: Context) {
      if (installed) return
      synchronized(this) {
        if (installed) return
        val relay = AcpRelay(context.applicationContext ?: context)
        PermissionPrompts.onAsk = AcpAppEvents::permission
        PermissionPrompts.onGone = AcpAppEvents::permissionGone
        Engines.addListener(relay.engines)
        AcpEngines.listener = relay
        installed = true
      }
    }
  }
}
