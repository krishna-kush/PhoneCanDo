package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.motion.Axis
import com.phonecando.runner.presence.glass.motion.Chain
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.motion.Glance
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Moves
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.motion.Tween

/**
 * The way in: the mascot peeks round the edge of the phone before it comes
 * in. From outside the screen it leans in round its side wall's edge until
 * its eye shows, looks about (eyes darting, a blink), turns and sees you,
 * and ducks back out of sight. A beat later it leans in again, slower and
 * warier, finds the coast clear, then hops in over the edge onto the wall
 * at [Perch] and lands with a squash.
 */
object Entrance {
  fun move(room: Room, body: Body, perch: Perch): Move {
    val to = room.pose(room.toSide(perch, body), body)
    val peek = Peek(room, body, to)
    val ahead = peek.ahead
    val up = Pt(ahead.x * 0.6f, -1f)
    val down = Pt(ahead.x * 0.3f, 0.8f)
    val back = Pt(-ahead.x, -0.2f)

    // One: leans in round the edge, a little too far and back.
    val leanIn = Tween(LEAN_IN_MS) { p ->
      val lean = LEAN * Ease.out(p) + LEAN * OVERSHOOT * Ease.arch(Ease.span(p, 0.45f, 1f))
      peek.at(Ease.mix(Peek.HIDDEN, PEEK, Ease.out(p)), lean)
    }
    // Looks about, its head going with its eyes: tipped back looking up,
    // drawn back looking over its shoulder; a blink.
    val stops = listOf(0L to ahead, 200L to up, 400L to down, 560L to back, 700L to ahead)
    val lookAbout = Tween(LOOK_MS) { p ->
      val t = (p * LOOK_MS).toLong()
      val gaze = Glance.dart(t, stops)
      val lean = LEAN + TILT * gaze.y + SHOULDER * (gaze.x * ahead.x - 1) / 2
      peek.at(PEEK, lean, gaze).copy(shut = Glance.blink(t, 620L))
    }
    // Sees you: turns to face you, eyes wide, with a start up and a stretch.
    // Face on, it is drawn with its shadow block on the edge's side, behind it.
    fun caught(pose: Pose) = pose.copy(facing = Facing.FRONT, eyes = Eyes.WIDE, gaze = Pt(0f, 0f), toward = peek.out)
    val spotted = Tween(SPOT_MS) { p ->
      val k = Ease.arch(Ease.span(p, 0f, 0.5f))
      val start = peek.at(PEEK, LEAN + 4f * k)
      caught(start.copy(y = start.y - body.h * 0.06f * k)).squashed(1 - 0.1f * k, 1 + 0.14f * k)
    }
    // And ducks out of sight, fast.
    val duck = Tween(DUCK_MS) { p ->
      val q = Ease.into(p)
      caught(peek.at(Ease.mix(PEEK, Peek.HIDDEN + 0.06f, q), LEAN * (1 - q)))
        .squashed(1 + 0.12f * Ease.arch(p), 1 - 0.08f * Ease.arch(p))
    }
    val hide = Moves.still(peek.hidden, HIDE_MS)
    // Two: a slower, warier lean, only just far enough for its eye.
    val slyIn = Tween(SLY_IN_MS) { p ->
      val q = Ease.inOut(p)
      peek.at(Ease.mix(Peek.HIDDEN, SLY, q), SLY_LEAN * q, Pt(ahead.x, 0.3f))
    }
    // Coast clear: a look, a slow blink, a look further in.
    val clear = Tween(CLEAR_MS) { p ->
      val t = (p * CLEAR_MS).toLong()
      val gaze = Glance.dart(t, listOf(0L to Pt(ahead.x, 0.3f), 140L to ahead, 400L to Pt(ahead.x, -0.4f)))
      peek.at(SLY, SLY_LEAN, gaze).copy(shut = Glance.blink(t, 180L, 240L))
    }
    // Then it commits: a crouch, a hop in over the edge, a squash on the wall.
    val hopIn = peek.hop(peek.at(SLY, SLY_LEAN), to, body.h * HOP_HIGH, HOP_MS, turn = 0.12f..0.7f)
    return Chain.of(leanIn, lookAbout, spotted, duck, hide, slyIn, clear, hopIn, Moves.settle(to, Axis.ACROSS, strength = 0.24f))
  }

  // Feet this many body widths out past the edge while it peeks, and how far it leans round it, degrees.
  internal const val PEEK = 0.37f
  private const val LEAN = 32f
  private const val OVERSHOOT = 0.18f

  // How much its head tips back looking up, and forward looking down, degrees.
  private const val TILT = 6f

  // How far it draws its head back looking over its shoulder, degrees.
  private const val SHOULDER = 9f

  // The second, warier peek.
  internal const val SLY = 0.4f
  internal const val SLY_LEAN = 24f

  private const val HOP_HIGH = 0.5f

  private const val LEAN_IN_MS = 380L
  private const val LOOK_MS = 820L
  private const val SPOT_MS = 260L
  private const val DUCK_MS = 160L
  private const val HIDE_MS = 360L
  private const val SLY_IN_MS = 520L
  private const val CLEAR_MS = 620L
  private const val HOP_MS = 520L
}
