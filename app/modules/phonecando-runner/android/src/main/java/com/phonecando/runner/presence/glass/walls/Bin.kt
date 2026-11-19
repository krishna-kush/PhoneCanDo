package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.motion.Tween
import kotlin.math.abs

/** The bin's box: its middle and half its side, in pixels. */
data class BinSpot(val x: Float, val y: Float, val half: Float)

// Where you drop a stopped agent's mascot to be done with it: while you
// drag it, a box comes up low in the middle of the screen, and let go
// over it, the agent is left stopped (Leave it) and the mascot drops in.
// Only in a pause (Scene.droppable): driving or watching, a drag just
// moves it. Pixels; pure.
object Bin {
  /** The box for [room], [dp] pixels to a dp: low in the middle, above the bars. */
  fun spot(room: Room, dp: Float): BinSpot {
    val half = SIDE_DP * dp / 2
    return BinSpot(room.w / 2, room.h - room.inBottom - BOTTOM_DP * dp - half, half)
  }

  /** Your finger at [finger] holds the mascot over the box, with [dp] pixels to a dp of slack round it. */
  fun over(spot: BinSpot, finger: Pt, dp: Float): Boolean {
    val reach = spot.half + SLACK_DP * dp
    return abs(finger.x - spot.x) <= reach && abs(finger.y - spot.y) <= reach
  }

  /** From [from], where you let go, into the box: it sinks to its middle, shrinking to nothing. */
  fun drop(from: Pose, spot: BinSpot): Move = Tween(DROP_MS) { p ->
    val q = Ease.into(p)
    val s = 1 - q
    Pose(Ease.mix(from.x, spot.x, Ease.out(p)), Ease.mix(from.y, spot.y + spot.half * 0.4f, q), sx = s, sy = s, toward = from.toward)
  }

  const val DROP_MS = 320L
  private const val SIDE_DP = 64f
  private const val BOTTOM_DP = 48f
  private const val SLACK_DP = 24f
}
