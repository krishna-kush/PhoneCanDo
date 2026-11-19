package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Chain
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.motion.Glance
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Moves
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.motion.Tween

// Nobody drives and nothing is handed over: the mascot leaves the way it
// came, the entrance's peek backwards and shorter. On a side wall it hops
// back out over the edge, still facing in, until only its eye shows round
// it, has a last look at you with a blink, and slips out of sight; on the
// top or bottom edge it hops off it, out of the screen.
object Exit {
  /** From [from], on [wall], to wholly off the screen. */
  fun move(room: Room, body: Body, wall: Wall, from: Pose): Move {
    if (wall.side) {
      val spot = from.copy(sx = 1f, sy = 1f, rot = 0f, toward = if (wall == Wall.RIGHT) -1 else 1)
      val peek = Peek(room, body, spot)
      val peeking = peek.at(Entrance.SLY, Entrance.SLY_LEAN)
      // Upright until its feet are past the edge, then it leans in round it.
      val backOut = peek.hop(spot, peeking, body.h * HOP_HIGH, BACK_MS, turn = 0.5f..0.95f)
      val lastLook = Tween(LOOK_MS) { p ->
        val t = (p * LOOK_MS).toLong()
        val gaze = Glance.dart(t, listOf(0L to peek.ahead, 120L to Pt(peek.ahead.x, 0.4f), 300L to peek.ahead))
        peek.at(Entrance.SLY, Entrance.SLY_LEAN + 4f * Ease.arch(Ease.span(p, 0.1f, 0.5f)), gaze).copy(shut = Glance.blink(t, 340L))
      }
      val away = Tween(AWAY_MS) { p ->
        val q = Ease.into(p)
        peek.at(Ease.mix(Entrance.SLY, Peek.HIDDEN + 0.06f, q), Entrance.SLY_LEAN * (1 - q))
      }
      return Chain.of(backOut, lastLook, away)
    }
    val out = when (wall) {
      Wall.BOTTOM -> from.copy(y = room.h + body.h * 1.3f, sx = 1f, sy = 1f)
      // Hanging from the top: a drop away from it, then up and out over it.
      else -> from.copy(y = -body.h * 1.3f, sx = 1f, sy = 1f)
    }
    return Moves.hop(from, out, body.h * 0.9f, HOP_MS)
  }

  private const val HOP_HIGH = 0.3f
  private const val BACK_MS = 400L
  private const val LOOK_MS = 560L
  private const val AWAY_MS = 170L
  private const val HOP_MS = 560L
}
