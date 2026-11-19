package com.phonecando.runner.presence.glass.figure

// A mascot laid out to draw, as mascot/layout/types.ts has it: boxes and
// marks in plain numbers from its feet (x 0 the middle of its two blocks,
// y 0 the bottom of the one behind, up is negative), the inks still named.
// The app lays them out (mascot/ is the one spec) and the glass only draws
// them, moving the pupils, the lids and the squash itself.

data class Box(val x: Float, val y: Float, val w: Float, val h: Float) {
  val right: Float get() = x + w
  val bottom: Float get() = y + h
}

/** What a mark is painted with; the glass turns each into a theme colour. */
enum class Ink { WEAR, RED, AMBER, EYE, DARK }

data class Painted(val fill: Ink?, val stroke: Ink?, val width: Float, val alpha: Float)

sealed interface Drawn {
  val paint: Painted

  data class Rect(val box: Box, override val paint: Painted) : Drawn

  data class Poly(val points: List<Pair<Float, Float>>, override val paint: Painted) : Drawn

  /** Part of an ellipse round (x, y), its angles in degrees, clockwise from three o'clock. */
  data class Arc(val x: Float, val y: Float, val rx: Float, val ry: Float, val from: Float, val to: Float, override val paint: Painted) : Drawn

  data class Line(val a: Pair<Float, Float>, val b: Pair<Float, Float>, override val paint: Painted) : Drawn
}

/** One eye: open as far as it goes, its lid as far down as the look has it, and its pupil when it shows. */
data class Eye(val open: Box, val lid: Box, val pupil: Box?)

data class Figure(
  val front: Box,
  val frontInk: Ink,
  val back: Box,
  val backInk: Ink,
  val eyes: List<Eye>,
  val marks: List<Drawn>,
  val bounds: Box,
)

/** Which way it is turned: its face to you, side on, or its back to you. */
enum class Facing { FRONT, SIDE, BACK }

/** How it looks out, mascot/layout/eyes.ts's names. */
enum class Eyes { DOT, WIDE, SLEEPY, SHUT, HAPPY }

/**
 * One agent's mascot in every pose the glass shows: face on in each look,
 * side on facing right (the glass mirrors it to face left), and from behind.
 */
data class Figures(val front: Map<Eyes, Figure>, val side: Map<Eyes, Figure>, val back: Figure) {
  /** The figure for a pose, falling back to open eyes where the app sent no such look. */
  fun pose(facing: Facing, eyes: Eyes): Figure = when (facing) {
    Facing.FRONT -> front[eyes] ?: front.getValue(Eyes.DOT)
    Facing.SIDE -> side[eyes] ?: side.getValue(Eyes.DOT)
    Facing.BACK -> back
  }

  /** The box round every pose, from the feet: what the glass keeps clear for it. */
  val reach: Box by lazy {
    val all = front.values + side.values + back
    val x0 = all.minOf { it.bounds.x }
    val y0 = all.minOf { it.bounds.y }
    val x1 = all.maxOf { it.bounds.right }
    val y1 = all.maxOf { it.bounds.bottom }
    Box(x0, y0, x1 - x0, y1 - y0)
  }
}
