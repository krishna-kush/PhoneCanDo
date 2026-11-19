package com.phonecando.runner.presence.glass

import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.motion.Glance
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.walls.Body
import com.phonecando.runner.presence.glass.walls.Entrance
import com.phonecando.runner.presence.glass.walls.Exit
import com.phonecando.runner.presence.glass.walls.Perch
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The peek round the screen's edge: eyes that dart and blink inside a
// move, a look that a move can set and hand back, and the way in and out
// showing only its leaning head past the edge, twice, with a duck between.
class PeekTest {
  private val room = Room(1080f, 2400f, inTop = 100f, inBottom = 60f)
  private val body = Body(120f, 120f, 16f)

  private fun onScreen(x: Float) = x > 0f && x < room.w

  /** Its feet out past the edge and the top of its head in: leaning round it. */
  private fun peeking(pose: Pose) = !onScreen(pose.x) && onScreen(pose.crown(body.h).x)

  private fun hidden(pose: Pose): Boolean {
    val a = room.area(pose, body)
    return a.right <= 0f || a.left >= room.w
  }

  private fun times(move: Move) = (0..move.ms step 10).toList()

  @Test
  fun eyesHoldThenDart() {
    val stops = listOf(0L to Pt(1f, 0f), 200L to Pt(1f, -1f))
    assertEquals(Pt(1f, 0f), Glance.dart(150, stops))
    assertEquals(-1f, Glance.dart(200 + Glance.DART_MS, stops).y, 0.001f)
    assertTrue(Glance.dart(230, stops).y in -0.99f..-0.01f)
  }

  @Test
  fun aBlinkShutsOnceThenOpens() {
    assertEquals(0f, Glance.blink(99, 100), 0f)
    assertTrue(Glance.blink(100 + Glance.BLINK_MS / 2, 100) > 0.95f)
    assertEquals(0f, Glance.blink(100 + Glance.BLINK_MS, 100), 0f)
  }

  @Test
  fun aMixMovesTheGazeAndKeepsALookOnlyOneEndGives() {
    val a = Pose(0f, 0f, gaze = Pt(-1f, 0f), shut = 0f, facing = Facing.SIDE)
    val b = Pose(10f, 0f, gaze = Pt(1f, 0f), shut = 1f, eyes = Eyes.WIDE)
    val mid = Pose.mix(a, b, 0.25f)
    assertEquals(-0.5f, mid.gaze!!.x, 0.001f)
    assertEquals(0.25f, mid.shut!!, 0.001f)
    assertEquals(Facing.SIDE, mid.facing)
    assertNull(mid.eyes)
    val late = Pose.mix(a, Pose(10f, 0f), 0.75f)
    assertNull(late.gaze)
    assertNull(late.facing)
  }

  @Test
  fun theEntrancePeeksTwiceDucksBetweenAndHandsItsLookBack() {
    for (wall in listOf(Wall.LEFT, Wall.RIGHT)) {
      val move = Entrance.move(room, body, Perch(wall, 1400f))
      val poses = times(move).map { move.at(it) }
      // Two peeks: hidden, leaning round the edge, hidden again, and round once more.
      var peeks = 0
      var wasHidden = true
      for (pose in poses) {
        if (hidden(pose)) wasHidden = true
        if (wasHidden && peeking(pose)) {
          peeks++
          wasHidden = false
        }
      }
      assertEquals("$wall peeks twice", 2, peeks)
      // Its eyes look about, it blinks, and it turns to you wide-eyed.
      val gazes = poses.filter { peeking(it) }.mapNotNull { it.gaze }.map { it.y }
      assertTrue("$wall looks up and down", gazes.min() < -0.5f && gazes.max() > 0.5f)
      assertTrue("$wall blinks", poses.any { (it.shut ?: 0f) > 0.9f })
      assertTrue("$wall sees you", poses.any { peeking(it) && it.facing == Facing.FRONT && it.eyes == Eyes.WIDE })
      // Standing on its wall, the stage has its look back.
      val end = move.end
      assertNull(end.facing)
      assertNull(end.gaze)
      assertNull(end.shut)
    }
  }

  @Test
  fun theExitBacksOutPeeksOnceAndBlinks() {
    val from = room.pose(Perch(Wall.LEFT, 1400f), body)
    val move = Exit.move(room, body, Wall.LEFT, from)
    val poses = times(move).map { move.at(it) }
    assertTrue(poses.any { peeking(it) })
    assertTrue(poses.any { peeking(it) && (it.shut ?: 0f) > 0.9f })
    assertTrue(hidden(move.end))
    // Facing in as it backs out, so it keeps you in sight.
    assertTrue(poses.all { it.toward == from.toward })
  }
}
