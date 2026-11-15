package com.phonecando.runner.checks.now

import android.content.Context
import com.phonecando.runner.bridge.BridgePrompts
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.messages.AgentState
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.prompts.PermissionPrompts

// One look at an agent while its check runs (CheckSample), from what the
// runner has anyway: its engine's status, the model server's prompt
// reading (it lists the agents it reads for), its ACP turn (AcpEngines
// snapshot: items and an open permission question), a question waiting for
// you (a permission or bridge prompt of it pending, or its chat waiting),
// its engine's last sign of work (the supervisor's lastSignAt), its bridge
// calls and hook reports (Checks.heard), and whether a view shows its
// terminal.
internal object CheckSampler {
  fun sample(app: Context, agentId: String, mode: EngineMode): CheckSample {
    val engines = Engines.peek()
    val status = engines?.status(agentId)
    val reading = engines?.promptReading()?.takeIf { agentId in it.agentIds }
    val acp = AcpEngines.of(agentId)?.snapshot()
    val waiting = Messages.get(app).view.presence(agentId).state == AgentState.WAITING
    return CheckSample(
      engine = if (status == null) "none" else "${status.state.wire}/${status.mode.wire}",
      ready = status != null && status.state == EngineState.READY && status.mode == mode,
      reading = reading?.let { CheckRun.Reading(it.read, it.total) },
      asking = acp?.permission != null || waiting ||
        asks(PermissionPrompts.pending(), agentId) || asks(BridgePrompts.pending(), agentId),
      acpItems = acp?.items?.size ?: 0,
      acpLast = acp?.items?.lastOrNull()?.toMap(),
      signAt = engines?.lastSignAt(agentId),
      heard = Checks.heard(agentId),
      viewer = engines?.hasViewer(agentId) == true,
    )
  }

  private fun asks(pending: List<Map<String, Any?>>, agentId: String): Boolean = pending.any { it["agentId"] == agentId }
}
