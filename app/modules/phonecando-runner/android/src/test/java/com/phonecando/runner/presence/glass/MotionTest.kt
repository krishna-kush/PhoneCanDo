package com.phonecando.runner.presence.glass

import com.phonecando.runner.presence.glass.motion.Axis
import com.phonecando.runner.presence.glass.motion.Chain
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.motion.Idle
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Moves
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.walls.Body
import com.phonecando.runner.presence.glass.walls.Entrance
import com.phonecando.runner.presence.glass.walls.Exit
import com.phonecando.runner.presence.glass.walls.Fling
import com.phonecando.runner.presence.glass.walls.Perch
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The mascot's moves: they start and end where they should, squash as
// they land, and the ways in and out start or end wholly off the screen.
class MotionTest {
  private val room = Room(1080f, 2400f, inTop = 100f, inBottom = 60f)
  private val body = Body(120f, 120f, 16f)

  private fun offScreen(move: Move, t: Long): Boolean {
    val a = room.area(move.at(t), body)
    return a.right <= 0f || a.left >= room.w || a.bottom <= 0f || a.top >= room.h
  }

  private fun squashedSomewhere(move: Move, from: Long) = (from..move.ms step 10).any { abs(move.at(it).sx - 1f) > 0.03f }

  private fun abs(v: Float) = kotlin.math.abs(v)

  @Test
  fun aHopCrouchesFliesAndSquashes() {
    assertEquals(Ease.hop(0f), Ease.hop(1f))
    assertTrue(Ease.hop(0.07f).sy < 1f)
    assertTrue(Ease.hop(0.5f).lift > 0.9f)
    assertTrue(Ease.hop(0.92f).sx > 1f)
  }

  @Test
  fun aChainPlaysItsPartsInTurn() {
    val a = Pose(0f, 0f)
    val b = Pose(100f, 0f)
    val c = Pose(100f, 100f)
    val chain = Chain.of(Moves.slide(a, b, 100), Moves.slide(b, c, 200))
    assertEquals(300L, chain.ms)
    assertEquals(0f, chain.at(0).x, 0.01f)
    assertEquals(100f, chain.at(100).x, 0.01f)
    assertEquals(100f, chain.end.y, 0.01f)
    assertEquals(c, chain.at(9_999))
  }

  @Test
  fun aSettleWobblesThenStands() {
    val pose = Pose(10f, 10f)
    val settle = Moves.settle(pose, Axis.ACROSS)
    assertTrue(settle.at(10).sx < 1f)
    assertEquals(pose, settle.end)
  }

  @Test
  fun theEntrancePeepsInOverTheEdgeThenStandsOnItsWall() {
    for (wall in listOf(Wall.LEFT, Wall.RIGHT)) {
      val perch = Perch(wall, 1400f)
      val move = Entrance.move(room, body, perch)
      assertTrue("$wall starts off", offScreen(move, 0))
      // Partway: only part of it shows, over its own wall's edge.
      val peeping = room.area(move.at(500), body)
      if (wall == Wall.RIGHT) {
        assertTrue("right peeps over the right edge", peeping.left < room.w && peeping.right > room.w)
      } else {
        assertTrue("left peeps over the left edge", peeping.left < 0f && peeping.right > 0f)
      }
      val end = move.end
      val there = room.pose(perch, body)
      assertEquals("$wall x", there.x, end.x, 0.5f)
      assertEquals("$wall y", there.y, end.y, 0.5f)
      assertEquals("$wall faces in", there.toward, end.toward)
      assertEquals(1f, end.sx, 0.001f)
      assertTrue("$wall squashes as it lands", squashedSomewhere(move, move.ms - Moves.SETTLE_MS - 200))
    }
  }

  @Test
  fun anEntranceFromTheTopEdgeGoesToASideWall() {
    val move = Entrance.move(room, body, Perch(Wall.TOP, 200f))
    assertEquals(room.pose(Perch(Wall.LEFT, 0f), body).x, move.end.x, 0.5f)
  }

  @Test
  fun aSideExitPeepsBackFromTheEdgeBeforeItGoes() {
    val perch = Perch(Wall.RIGHT, 1400f)
    val move = Exit.move(room, body, Wall.RIGHT, room.pose(perch, body))
    val peeping = room.area(move.at(400), body)
    assertTrue(peeping.left < room.w && peeping.right > room.w)
  }

  @Test
  fun everyExitEndsOffScreen() {
    for (wall in Wall.entries) {
      val perch = room.clamp(Perch(wall, if (wall.side) 1400f else 500f), body)
      val move = Exit.move(room, body, wall, room.pose(perch, body))
      assertFalse("$wall starts on", offScreen(move, 0))
      assertTrue("$wall ends off", offScreen(move, move.ms))
    }
  }

  @Test
  fun aThrowLandsOnItsPerchAndSquashes() {
    val to = Perch(Wall.TOP, 400f)
    val move = Fling.move(room, body, Pose(700f, 1200f), to)
    val there = room.pose(to, body)
    assertEquals(there, move.end)
    assertTrue(squashedSomewhere(move, 0))
  }

  @Test
  fun blinksNowAndThenNeverStuck() {
    val shut = (0L until 20_000L step 10).map { Idle.blink(it) }
    assertTrue(shut.all { it in 0f..1f })
    assertTrue(shut.count { it > 0.5f } in 5..200)
    assertTrue(shut.count { it == 0f } > shut.size * 0.9)
  }

  @Test
  fun lookingAtAPointStaysInRange() {
    val g = Idle.lookAt(com.phonecando.runner.presence.glass.motion.Pt(0f, 0f), com.phonecando.runner.presence.glass.motion.Pt(-900f, 10f), 200f)
    assertEquals(-1f, g.x, 0.01f)
    assertTrue(Idle.glow(1234) in 0.45f..1f)
  }
}
