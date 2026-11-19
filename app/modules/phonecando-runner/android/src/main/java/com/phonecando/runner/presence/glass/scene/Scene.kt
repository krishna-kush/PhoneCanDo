package com.phonecando.runner.presence.glass.scene

import com.phonecando.runner.presence.HandMode
import com.phonecando.runner.presence.PresenceFrame
import com.phonecando.runner.presence.StatusMood
import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing

/** What the agent on the glass is doing with the phone: driving it, watching you, or paused while you have it. */
enum class Act { DRIVING, WATCH, PAUSED }

/** The glass's reading of a presence frame: whose mascot it shows and what it is about. */
data class Scene(
  val agentId: String,
  val name: String,
  val act: Act,
  /** The agent's reason for a hand-over it asked for; null when you started it. */
  val why: String?,
  /** Its status line, if it set one. */
  val status: String?,
  val mood: StatusMood?,
  /** When the hand-over began (elapsedRealtime), so a new one is told from the same one again. */
  val since: Long?,
) {
  companion object {
    /** The hand-over wins over the driver; nobody driving and nothing handed over shows nothing. */
    fun of(frame: PresenceFrame): Scene? {
      val hand = frame.handOver
      if (hand != null) {
        val status = frame.statuses[hand.agentId]
        val act = if (hand.mode == HandMode.WATCH) Act.WATCH else Act.PAUSED
        return Scene(hand.agentId, hand.agentName, act, hand.why?.takeIf { it.isNotBlank() }, status?.text, status?.mood, hand.since)
      }
      val driver = frame.driver ?: return null
      val status = frame.statuses[driver.agentId]
      return Scene(driver.agentId, driver.name, Act.DRIVING, null, status?.text?.takeIf { it.isNotBlank() }, status?.mood, null)
    }
  }
}

/** How the edge of the screen is lit. */
enum class Glow { RED, AMBER, OFF }

/** Which card is up beside the mascot. */
enum class Card { NONE, CONTROLS, YOUR_TURN, NOT_LOOKING, ASLEEP }

/**
 * Everything the glass shows for a scene: how the mascot turns and looks,
 * the edge's glow, its card, its speech bubble and whether it is thinking
 * or asleep.
 */
data class Show(
  val facing: Facing,
  val eyes: Eyes,
  val glow: Glow,
  val card: Card,
  val bubble: String?,
  val thinking: Boolean,
  val asleep: Boolean,
) {
  companion object {
    /**
     * [controls]: you tapped it while it drives and its buttons are up.
     * [rested]: in a pause, you said you are done, so it went to sleep in
     * a corner. [folded]: you tapped it to put its card away for now.
     */
    fun of(scene: Scene, controls: Boolean, rested: Boolean, folded: Boolean): Show = when (scene.act) {
      Act.DRIVING ->
        if (controls) {
          Show(Facing.FRONT, Eyes.WIDE, Glow.RED, Card.CONTROLS, null, thinking = false, asleep = false)
        } else {
          val thinking = scene.mood == StatusMood.THINKING
          Show(Facing.SIDE, Eyes.DOT, Glow.RED, Card.NONE, scene.status, thinking, asleep = false)
        }
      Act.WATCH -> Show(Facing.FRONT, Eyes.DOT, Glow.AMBER, if (folded) Card.NONE else Card.YOUR_TURN, null, thinking = false, asleep = false)
      Act.PAUSED ->
        if (rested) {
          Show(Facing.FRONT, Eyes.SHUT, Glow.OFF, if (folded) Card.NONE else Card.ASLEEP, null, thinking = false, asleep = true)
        } else {
          Show(Facing.BACK, Eyes.DOT, Glow.OFF, if (folded) Card.NONE else Card.NOT_LOOKING, null, thinking = false, asleep = false)
        }
    }
  }
}
