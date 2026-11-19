package com.phonecando.runner.presence.glass

import com.phonecando.runner.bridge.ScreenLease
import com.phonecando.runner.presence.AgentStatus
import com.phonecando.runner.presence.HandBy
import com.phonecando.runner.presence.HandMode
import com.phonecando.runner.presence.HandOver
import com.phonecando.runner.presence.PresenceFrame
import com.phonecando.runner.presence.StatusMood
import com.phonecando.runner.presence.UserAct
import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.scene.Act
import com.phonecando.runner.presence.glass.scene.Card
import com.phonecando.runner.presence.glass.scene.GlassCopy
import com.phonecando.runner.presence.glass.scene.Glow
import com.phonecando.runner.presence.glass.scene.Own
import com.phonecando.runner.presence.glass.scene.Scene
import com.phonecando.runner.presence.glass.scene.Show
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// What the glass shows for each frame, and the words and buttons on it.
class SceneTest {
  private val seat = ScreenLease.Seat("a1", "Rex")
  private val working = mapOf("a1" to AgentStatus("Opening Settings", StatusMood.WORKING, 1))

  private fun hand(mode: HandMode, why: String? = null) = HandOver("a1", "Rex", mode, if (why == null) HandBy.USER else HandBy.AGENT, why, 5)

  @Test
  fun nobodyDrivingAndNothingHandedOverShowsNothing() {
    assertNull(Scene.of(PresenceFrame.EMPTY))
    assertNull(Scene.of(PresenceFrame(null, null, working)))
  }

  @Test
  fun drivingSaysItsStatusSideOnWithTheRedGlow() {
    val scene = Scene.of(PresenceFrame(seat, null, working))!!
    assertEquals(Act.DRIVING, scene.act)
    val show = Show.of(scene, controls = false, rested = false, folded = false)
    assertEquals(Facing.SIDE, show.facing)
    assertEquals(Glow.RED, show.glow)
    assertEquals("Opening Settings", show.bubble)
    assertFalse(show.thinking)
    assertEquals(Card.NONE, show.card)
  }

  @Test
  fun thinkingShowsItsDots() {
    val frame = PresenceFrame(seat, null, mapOf("a1" to AgentStatus("", StatusMood.THINKING, 1)))
    val show = Show.of(Scene.of(frame)!!, controls = false, rested = false, folded = false)
    assertTrue(show.thinking)
    assertNull(show.bubble)
  }

  @Test
  fun aTapWhileDrivingGivesLetMeAndStop() {
    val scene = Scene.of(PresenceFrame(seat, null, working))!!
    val show = Show.of(scene, controls = true, rested = false, folded = false)
    assertEquals(Facing.FRONT, show.facing)
    val copy = GlassCopy.card(show.card, scene)!!
    assertEquals(listOf(UserAct.LET_ME, UserAct.STOP), copy.buttons.map { it.act })
    assertEquals(listOf("Let me", "Stop"), copy.buttons.map { it.label })
  }

  @Test
  fun theHandOverWinsOverTheDriver() {
    val scene = Scene.of(PresenceFrame(ScreenLease.Seat("b2", "Ava"), hand(HandMode.WATCH), emptyMap()))!!
    assertEquals("a1", scene.agentId)
    assertEquals(Act.WATCH, scene.act)
  }

  @Test
  fun watchingTurnsToYouWithItsReasonAndDone() {
    val scene = Scene.of(PresenceFrame(null, hand(HandMode.WATCH, "Pick the photo you want"), emptyMap()))!!
    val show = Show.of(scene, controls = false, rested = false, folded = false)
    assertEquals(Facing.FRONT, show.facing)
    assertEquals(Glow.AMBER, show.glow)
    val copy = GlassCopy.card(show.card, scene)!!
    assertEquals("Pick the photo you want", copy.title)
    assertEquals(listOf(UserAct.GIVE_BACK), copy.buttons.map { it.act })
    assertEquals("Your turn", GlassCopy.card(Card.YOUR_TURN, Scene.of(PresenceFrame(null, hand(HandMode.WATCH), emptyMap()))!!)!!.title)
    // Folded away with a tap.
    assertEquals(Card.NONE, Show.of(scene, controls = false, rested = false, folded = true).card)
  }

  @Test
  fun pausedTurnsItsBackThenSleeps() {
    val scene = Scene.of(PresenceFrame(null, hand(HandMode.PAUSED), emptyMap()))!!
    val away = Show.of(scene, controls = false, rested = false, folded = false)
    assertEquals(Facing.BACK, away.facing)
    assertEquals(Glow.OFF, away.glow)
    val sign = GlassCopy.card(away.card, scene)!!
    assertEquals("Not looking", sign.title)
    // "I'm done" is the glass's own step: no act.
    assertNull(sign.buttons.single().act)
    assertEquals(Own.REST, sign.buttons.single().own)
    val asleep = Show.of(scene, controls = false, rested = true, folded = false)
    assertTrue(asleep.asleep)
    assertEquals(Eyes.SHUT, asleep.eyes)
    val card = GlassCopy.card(asleep.card, scene)!!
    assertEquals(listOf(UserAct.START_AGAIN, null, UserAct.LEAVE), card.buttons.map { it.act })
    assertEquals("Start me again", card.buttons[0].label)
    // Go to app opens the agent's chat and leaves the pause as it is.
    assertEquals(Own.OPEN_APP, card.buttons[1].own)
    assertTrue(card.buttons[2].small)
  }

  @Test
  fun neverCallsYouTheOwner() {
    val scenes = listOf(
      Scene.of(PresenceFrame(seat, null, working))!!,
      Scene.of(PresenceFrame(null, hand(HandMode.WATCH), emptyMap()))!!,
      Scene.of(PresenceFrame(null, hand(HandMode.PAUSED), emptyMap()))!!,
    )
    for (scene in scenes) {
      for (card in Card.entries) {
        val copy = GlassCopy.card(card, scene) ?: continue
        val words = listOf(copy.title, copy.line.orEmpty()) + copy.buttons.flatMap { listOf(it.label, it.says) }
        assertFalse(words.any { it.contains("owner", ignoreCase = true) })
      }
      for (rested in listOf(false, true)) {
        assertFalse(GlassCopy.mascot(scene, Show.of(scene, false, rested, false)).contains("owner", ignoreCase = true))
      }
    }
  }
}
