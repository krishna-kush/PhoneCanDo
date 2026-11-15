package com.phonecando.runner.messages.delivery

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.engine.acp.AcpAgentHandle
import java.util.concurrent.ConcurrentHashMap

// Hands an agent in ACP mode its set as a prompt (RoutingCourier sends only
// a set that may wake it, while no turn runs; an engine started for a
// message is busy until its first prompt, and takes this): in a chat of
// its own titled Parcel.newChat when a scheduled task asks for one, else in
// its current chat. A prompt it took started its turn: WOKE. Busy, not ready, or the
// prompt refused: NONE, and the set stays queued for the next try (the turn
// ending, the engine ready, a chat-board change); after a refusal a retry
// waits RETRY_MS (a new message does not). Never waits for the turn.
// Claims nothing: a prompt is delivered when it is taken.
class AcpCourier(
  private val handle: (String) -> AcpAgentHandle?,
  private val clock: () -> Long = System::currentTimeMillis,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) : Courier {
  private val failedAt = ConcurrentHashMap<String, Long>()

  override fun claimed(agent: AgentRecord): Set<Long> = emptySet()

  override fun handOver(agent: AgentRecord, parcel: Parcel, retry: Boolean): Handover {
    if (retry && failedAt[agent.id]?.let { clock() - it < RETRY_MS } == true) return Handover.NONE
    val h = handle(agent.id) ?: return Handover.NONE
    // Busy only while it waits for the work it was started for: it takes this.
    if (h.busy && !h.waitingForWork) return Handover.NONE
    val took = try {
      h.prompt(parcel.text, parcel.newChat != null, parcel.newChat) {}
    } catch (e: Exception) {
      onError("prompt to ${agent.id} failed", e)
      false
    }
    if (took) {
      failedAt.remove(agent.id)
      return Handover.WOKE
    }
    failedAt[agent.id] = clock()
    return Handover.NONE
  }

  override fun clear(agent: AgentRecord) {}

  override fun prepare(agent: AgentRecord) {
    failedAt.remove(agent.id)
  }

  override fun forget(agentId: String) {
    failedAt.remove(agentId)
  }

  companion object {
    /** After a refused prompt, a retry waits this long. */
    const val RETRY_MS = 15_000L
  }
}
