package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Chain
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Moves
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import kotlin.math.hypot

// You let go of the mascot: it flies on the way you threw it to the wall
// nearest where it was headed, and squashes against it. Let go gently, it
// goes to the wall nearest where it is.
object Fling {
  /** Where it lands, let go with its middle at [at] going [v] pixels a second. */
  fun land(room: Room, body: Body, at: Pt, v: Pt): Perch {
    val fast = hypot(v.x, v.y) > GENTLE
    val ahead = if (fast) Pt(at.x + v.x * AHEAD_S, at.y + v.y * AHEAD_S) else at
    val inside = Pt(ahead.x.coerceIn(room.inLeft, room.w - room.inRight), ahead.y.coerceIn(room.inTop, room.h - room.inBottom))
    return room.nearest(inside, body)
  }

  /** The flight from [from] (where you let go) to [perch], then the squash as it hits the wall. */
  fun move(room: Room, body: Body, from: Pose, perch: Perch): Move {
    val to = room.pose(perch, body)
    val ms = Moves.msFor(Moves.distance(from, to), PX_PER_MS, MIN_MS, MAX_MS)
    // Rolling over to hang from the top edge: forward, the way it was thrown.
    val end = if (to.rot > 90f && from.x > to.x) to.copy(rot = -180f) else to
    return Chain.of(Moves.fly(from, end, ms), Moves.settle(to, perch.wall.knock, strength = 0.28f))
  }

  /** A throw slower than this, pixels a second, is only a let-go. */
  private const val GENTLE = 600f

  /** How far ahead along the throw it looks for the wall, seconds. */
  private const val AHEAD_S = 0.22f
  private const val PX_PER_MS = 3.2f
  private const val MIN_MS = 160L
  private const val MAX_MS = 420L
}
