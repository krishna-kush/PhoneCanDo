package com.phonecando.runner.checks

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.engine.EngineMode

/** How one capability of an agent reads now; [wire] is the name JS sees. */
enum class CheckState(val wire: String) {
  /** A signal showed it working with this setting. */
  CHECKED("checked"),

  /** A signal showed it not working with this setting. */
  FAILED("failed"),

  /** Set up, but nothing showed it either way with this setting yet. */
  UNCHECKED("unchecked"),

  /** Not set up for this agent. */
  OFF("off"),
  ;

  companion object {
    fun of(wire: String): CheckState? = values().firstOrNull { it.wire == wire }
  }
}

/**
 * What the newest signal showed for a kind's capability: [state] CHECKED
 * or FAILED, with the setting it belongs to ([key], kit
 * KindCapabilities.key), the CLI version of the agent it was seen on (its
 * installedVersion, empty when none), when, and for a failure its [code]
 * and [detail].
 */
data class CheckRecord(
  val state: CheckState,
  val key: String,
  val cliVersion: String,
  val at: Long,
  val agentId: String,
  val code: String?,
  val detail: String?,
)

/** One capability as an agent reads it now. */
data class CapabilityView(
  val capability: Capability,
  val state: CheckState,
  val cliVersion: String?,
  val at: Long?,
  val code: String?,
  val detail: String?,
)

/** A record kept for [kindId]'s [capability], from a signal of [agentId]'s; [firstFailure]: notify once (Checks). */
data class CheckChange(
  val agentId: String,
  val kindId: String,
  val capability: Capability,
  val record: CheckRecord,
  val firstFailure: Boolean,
)

/** How a turn ended (LifeEvent.TurnEnded). */
enum class TurnEnd { FINISHED, FAILED, STOPPED }

/** What an agent's engine life did, for Check now (checks/now/). */
sealed interface LifeEvent {
  /**
   * A turn ended, and how: finished (a terminal FINISHED event, an ACP
   * end_turn), failed (a terminal FAILED event after it worked, an ACP
   * error or other stop reason) or stopped (a terminal STOPPED event after
   * it worked, an ACP cancel). Only a finished turn feeds the rules.
   */
  data class TurnEnded(val mode: EngineMode, val end: TurnEnd = TurnEnd.FINISHED) : LifeEvent

  /** The life is over: [failed] when it died or its start failed, with why. */
  data class EngineEnded(val failed: Boolean, val detail: String?) : LifeEvent
}
