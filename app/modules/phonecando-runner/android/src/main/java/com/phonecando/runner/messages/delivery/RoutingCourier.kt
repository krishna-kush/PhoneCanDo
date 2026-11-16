package com.phonecando.runner.messages.delivery

import com.phonecando.runner.agents.AgentRecord
import java.util.concurrent.ConcurrentHashMap

// The mailbox's one courier: a new set that may wake a stopped agent asks
// for its start (start(): the mailbox let it, start/StartRules; in ACP mode
// for a kind with one) and answers STARTING, or, refused or a retry, goes
// to the folder without the wake mark; once its engine is ready, the mailbox's next try
// hands the set over as below. Every other set goes the way AcpRoute picks
// for its agent now.
// - PROMPT: what its folder still holds goes first (a hook mid-turn must not
//   print it again), then the AcpCourier prompts it.
// - SWITCH: we ask its engine to switch to ACP mode (switchToAcp, the
//   engine service's start request) and answer SWITCHING; once ACP mode is
//   ready, the mailbox's next try prompts it. While that request is under
//   SWITCH_WAIT_MS old we do not ask again. A switch that never came (still
//   ready in terminal mode after that), or a request Android refused, leaves
//   the set to the InboxCourier for SWITCH_HOLD_MS, as for a terminal agent
//   today; then we may ask again.
// - INBOX: the InboxCourier (folder, server, or nothing), as every kind
//   without an ACP mode; for an agent in ACP mode (its hooks or reader may
//   take it mid-turn, or next turn) without the wake mark (AcpRoute.
//   folderWake), so only our prompt ever starts its turn.
// - NONE: nothing takes it now.
// IO only through the injected couriers, look, folder, switch and start.
class RoutingCourier(
  private val inbox: Courier,
  private val acp: Courier,
  private val look: (AgentRecord) -> AcpRoute.Look,
  /** The kind's hooks or reader read its inbox folder (InboxPlan.folder). */
  private val folder: (AgentRecord) -> Boolean,
  /** Asks for the agent's engine in ACP mode; false when the request was refused. */
  private val switchToAcp: (AgentRecord) -> Boolean,
  private val clock: () -> Long = System::currentTimeMillis,
  /** Nothing of the agent's engine runs (stopped, failed or died). */
  private val stopped: (AgentRecord) -> Boolean = { false },
  /** Asks for the stopped agent's engine, for its messages; false when the request was refused. */
  private val start: (AgentRecord) -> Boolean = { false },
) : Courier {
  // When we last asked each agent's engine to switch to ACP mode, and whether that request went out.
  private val switches = ConcurrentHashMap<String, Pair<Long, Boolean>>()

  override fun claimed(agent: AgentRecord): Set<Long> = inbox.claimed(agent) + acp.claimed(agent)

  override fun handOver(agent: AgentRecord, parcel: Parcel, retry: Boolean): Handover {
    // Only a new message starts it: a retry (its set built while it ran) never does.
    if (parcel.wake && stopped(agent)) {
      return if (!retry && start(agent)) Handover.STARTING else inbox.handOver(agent, parcel.copy(wake = false), retry)
    }
    val now = look(agent)
    if (now.acpReady) switches.remove(agent.id)
    return when (AcpRoute.decide(now, parcel.wake, folder(agent))) {
      AcpRoute.Way.PROMPT -> {
        inbox.clear(agent)
        acp.handOver(agent, parcel, retry)
      }
      AcpRoute.Way.SWITCH -> switch(agent, parcel, retry)
      AcpRoute.Way.INBOX -> inbox.handOver(agent, parcel.copy(wake = AcpRoute.folderWake(now, parcel.wake)), retry)
      AcpRoute.Way.NONE -> Handover.NONE
    }
  }

  private fun switch(agent: AgentRecord, parcel: Parcel, retry: Boolean): Handover {
    val at = clock()
    switches[agent.id]?.let { (askedAt, went) ->
      val age = at - askedAt
      if (went && age < SWITCH_WAIT_MS) return Handover.SWITCHING
      if (age < SWITCH_HOLD_MS) return inbox.handOver(agent, parcel, retry)
    }
    val asked = switchToAcp(agent)
    switches[agent.id] = at to asked
    return if (asked) Handover.SWITCHING else inbox.handOver(agent, parcel, retry)
  }

  override fun clear(agent: AgentRecord) {
    inbox.clear(agent)
    acp.clear(agent)
  }

  // A new engine life (the switch came, or any start): a later set may ask again.
  override fun prepare(agent: AgentRecord) {
    switches.remove(agent.id)
    inbox.prepare(agent)
    acp.prepare(agent)
  }

  override fun forget(agentId: String) {
    switches.remove(agentId)
    inbox.forget(agentId)
    acp.forget(agentId)
  }

  companion object {
    /** A switch we asked for has this long to leave terminal mode before we count it as not coming. */
    const val SWITCH_WAIT_MS = 30_000L

    /** After a switch that did not come, or was refused, the folder takes sets this long before we ask again. */
    const val SWITCH_HOLD_MS = 10 * 60_000L
  }
}
