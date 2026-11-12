package com.phonecando.runner.messages

import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.messages.delivery.Courier
import com.phonecando.runner.messages.delivery.Handover
import com.phonecando.runner.messages.delivery.Parcel
import java.io.File
import java.nio.file.Files

// Test agents, a fake view of them and a courier that records what it was
// handed, for the mailbox and the routes.
fun agent(id: String, name: String = id, image: String = "m1", kind: String = "claude-code", wakeable: Boolean = true) =
  AgentRecord(id, kind, name, image, null, "pw-$id", "tok-$id", 0L, wakeable = wakeable)

class FakeView(vararg agents: AgentRecord) : AgentsView {
  val records = agents.toMutableList()
  val presences = HashMap<String, Presence>()
  val canWake = HashMap<String, Boolean>()

  /** Per kind; by default what canWake says (wakes, else delivered). */
  val levels = HashMap<String, MessagingLevel>()

  /** Per agent: a kind that wakes through a waiting hook has it alive (true by default). */
  val waiters = HashMap<String, Boolean>()
  var line = ScreenLine.NONE

  override fun all(): List<AgentRecord> = records.toList()

  override fun kindLabel(kind: String): String = when (kind) {
    "claude-code" -> "Claude Code"
    "opencode" -> "opencode"
    else -> kind
  }

  override fun kindCanWake(kind: String): Boolean = canWake[kind] ?: true

  override fun kindLevel(kind: String): MessagingLevel =
    levels[kind] ?: if (kindCanWake(kind)) MessagingLevel.WAKES else MessagingLevel.DELIVERED

  override fun wakeReady(agent: AgentRecord): Boolean = waiters[agent.id] ?: true

  override fun presence(agentId: String): Presence = presences[agentId] ?: Presence(AgentState.IDLE)

  override fun screen(): ScreenLine = line

  fun set(agentId: String, state: AgentState, chat: String? = null) {
    presences[agentId] = Presence(state, chat)
  }
}

class FakeCourier : Courier {
  /** What each handOver got, per agent. */
  val handed = ArrayList<Pair<String, Parcel>>()
  val cleared = ArrayList<String>()

  /** What handOver answers, per agent (HELD by default). */
  val answers = HashMap<String, Handover>()

  /** What the next claimed() answers, per agent. */
  val claims = HashMap<String, Set<Long>>()

  override fun claimed(agent: AgentRecord): Set<Long> = claims.remove(agent.id).orEmpty()

  override fun handOver(agent: AgentRecord, parcel: Parcel, retry: Boolean): Handover {
    handed += agent.id to parcel
    return answers[agent.id] ?: Handover.HELD
  }

  override fun clear(agent: AgentRecord) {
    cleared += agent.id
  }

  fun last(agentId: String): Parcel? = handed.lastOrNull { it.first == agentId }?.second
}

/** A fresh log file in a temp folder. */
fun tempLog(): File = File(Files.createTempDirectory("messages").toFile(), "state/messages.jsonl")
