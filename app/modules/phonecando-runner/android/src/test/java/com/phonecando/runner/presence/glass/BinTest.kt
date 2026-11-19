package com.phonecando.runner.presence.glass

import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.scene.Act
import com.phonecando.runner.presence.glass.scene.Scene
import com.phonecando.runner.presence.glass.walls.Bin
import com.phonecando.runner.presence.glass.walls.Room
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The bin a stopped agent's mascot is dropped on: only in a pause, low in
// the middle above the bars, what counts as over it, and the drop in.
class BinTest {
  private val room = Room(1080f, 2400f, inTop = 100f, inBottom = 60f)
  private val dp = 3f

  @Test
  fun onlyAPauseOffersIt() {
    val scene = Scene("a1", "opencode", Act.PAUSED, null, null, null, 0L)
    assertTrue(scene.droppable)
    assertFalse(scene.copy(act = Act.WATCH).droppable)
    assertFalse(scene.copy(act = Act.DRIVING).droppable)
  }

  @Test
  fun itSitsLowInTheMiddleAboveTheBars() {
    val spot = Bin.spot(room, dp)
    assertEquals(540f, spot.x, 0.01f)
    assertEquals(96f, spot.half, 0.01f)
    // 48 dp above the bottom bar, to its bottom edge.
    assertEquals(2400f - 60f - 144f, spot.y + spot.half, 0.01f)
  }

  @Test
  fun overItTakesTheBoxAndALittleSlack() {
    val spot = Bin.spot(room, dp)
    assertTrue(Bin.over(spot, Pt(spot.x, spot.y), dp))
    // Half the box plus 24 dp each way.
    assertTrue(Bin.over(spot, Pt(spot.x + 96f + 72f, spot.y - 96f - 72f), dp))
    assertFalse(Bin.over(spot, Pt(spot.x + 96f + 73f, spot.y), dp))
    assertFalse(Bin.over(spot, Pt(spot.x, spot.y - 300f), dp))
  }

  @Test
  fun itDropsInShrinkingToNothing() {
    val spot = Bin.spot(room, dp)
    val from = Pose(200f, 1500f, toward = -1)
    val move = Bin.drop(from, spot)
    val start = move.at(0)
    assertEquals(200f, start.x, 0.01f)
    assertEquals(1f, start.sx, 0.01f)
    val end = move.end
    assertEquals(spot.x, end.x, 0.01f)
    assertEquals(0f, end.sx, 0.01f)
    assertEquals(0f, end.sy, 0.01f)
    assertEquals(-1, end.toward)
  }
}
