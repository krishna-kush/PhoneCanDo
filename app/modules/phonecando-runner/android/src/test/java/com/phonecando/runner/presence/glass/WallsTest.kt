package com.phonecando.runner.presence.glass

import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.walls.Beside
import com.phonecando.runner.presence.glass.walls.Body
import com.phonecando.runner.presence.glass.walls.Dodge
import com.phonecando.runner.presence.glass.walls.Fling
import com.phonecando.runner.presence.glass.walls.Perch
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Where the mascot sticks, follows the agent's touches out of their way,
// lands when thrown, and where its card goes.
class WallsTest {
  private val room = Room(1080f, 2400f, inTop = 100f, inBottom = 60f)
  private val body = Body(120f, 120f, 16f)

  @Test
  fun eachWallFacesIntoTheScreen() {
    val left = room.pose(Perch(Wall.LEFT, 1000f), body)
    assertEquals(1, left.toward)
    assertEquals(16f + 60f, left.x, 0.01f)
    val right = room.pose(Perch(Wall.RIGHT, 1000f), body)
    assertEquals(-1, right.toward)
    assertEquals(1080f - 16f - 60f, right.x, 0.01f)
    val top = room.pose(Perch(Wall.TOP, 300f), body)
    assertEquals(180f, top.rot, 0f)
    assertEquals(116f, top.y, 0.01f)
    // Hanging, it covers the screen below its feet.
    val area = room.area(top, body)
    assertEquals(116f, area.top, 0.01f)
    assertEquals(236f, area.bottom, 0.01f)
    val bottom = room.pose(Perch(Wall.BOTTOM, 900f), body)
    assertEquals(2400f - 60f - 16f, bottom.y, 0.01f)
    assertEquals(-1, bottom.toward)
  }

  @Test
  fun aPerchStaysInsideTheBars() {
    val high = room.clamp(Perch(Wall.LEFT, 0f), body)
    assertEquals(100f + 16f + 120f, high.along, 0.01f)
    val low = room.clamp(Perch(Wall.RIGHT, 9999f), body)
    assertEquals(2400f - 60f - 16f, low.along, 0.01f)
  }

  @Test
  fun entrancesHeadForASideWall() {
    assertEquals(Wall.LEFT, room.toSide(Perch(Wall.TOP, 200f), body).wall)
    assertEquals(Wall.RIGHT, room.toSide(Perch(Wall.BOTTOM, 900f), body).wall)
    assertEquals(Wall.RIGHT, room.home(body).wall)
  }

  @Test
  fun followsLevelWithTheTouch() {
    val at = Perch(Wall.RIGHT, 2000f)
    val next = Dodge.follow(room, body, at, listOf(Pt(400f, 800f)))
    assertEquals(Wall.RIGHT, next.wall)
    // Its middle level with the spot.
    assertEquals(860f, next.along, 0.01f)
  }

  @Test
  fun dodgesATouchThatWouldLandUnderIt() {
    val at = Perch(Wall.RIGHT, 1000f)
    val spot = Pt(1000f, 950f)
    assertTrue(Dodge.under(room, body, at, listOf(spot)))
    val next = Dodge.follow(room, body, at, listOf(spot))
    assertEquals(Wall.RIGHT, next.wall)
    assertFalse(Dodge.under(room, body, next, listOf(spot)))
  }

  @Test
  fun dodgesASwipeAlongItsWall() {
    val at = Perch(Wall.RIGHT, 1200f)
    val swipe = listOf(Pt(1010f, 150f), Pt(1010f, 2300f))
    val next = Dodge.follow(room, body, at, swipe)
    // Nowhere on the right wall is clear of a swipe down it: the other wall.
    assertEquals(Wall.LEFT, next.wall)
    assertFalse(Dodge.under(room, body, next, swipe))
  }

  @Test
  fun aGentleLetGoGoesToTheNearestWall() {
    assertEquals(Wall.LEFT, Fling.land(room, body, Pt(150f, 1200f), Pt(0f, 0f)).wall)
    assertEquals(Wall.BOTTOM, Fling.land(room, body, Pt(540f, 2250f), Pt(100f, 0f)).wall)
  }

  @Test
  fun aThrowGoesTheWayItWasThrown() {
    assertEquals(Wall.LEFT, Fling.land(room, body, Pt(700f, 1200f), Pt(-4000f, 0f)).wall)
    assertEquals(Wall.TOP, Fling.land(room, body, Pt(540f, 600f), Pt(0f, -5000f)).wall)
    assertEquals(Wall.RIGHT, Fling.land(room, body, Pt(300f, 1200f), Pt(5000f, 300f)).wall)
  }

  @Test
  fun aCardSitsBesideItOnScreen() {
    val right = room.area(room.pose(Perch(Wall.RIGHT, 1000f), body), body)
    val at = Beside.place(room, right, Wall.RIGHT, 500f, 200f, 20f)
    assertEquals(right.left - 20f - 500f, at.x, 0.01f)
    val left = room.area(room.pose(Perch(Wall.LEFT, 400f), body), body)
    val there = Beside.place(room, left, Wall.LEFT, 500f, 400f, 20f)
    assertEquals(left.right + 20f, there.x, 0.01f)
    // Never above the status bar.
    assertTrue(there.y >= 120f)
    val bottom = room.area(room.pose(Perch(Wall.BOTTOM, 1000f), body), body)
    val above = Beside.place(room, bottom, Wall.BOTTOM, 600f, 200f, 20f)
    assertEquals(bottom.top - 220f, above.y, 0.01f)
    // Kept on screen at the right edge.
    assertTrue(above.x + 600f <= 1080f - 20f + 0.01f)
    assertNotEquals(0f, above.x)
  }
}
