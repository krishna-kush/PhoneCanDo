package com.phonecando.runner.presence.glass.figure

// Plain A-01 (mascot/look.ts PLAIN: square, red in front, nothing worn),
// laid out here as mascot/layout/figure.ts and eyes.ts do at size 100, for
// an agent whose figures the app has not sent yet. Same numbers, so it
// looks the same as a plain agent's own figures would.
object PlainFigures {
  val FIGURES: Figures by lazy {
    Figures(
      front = Eyes.entries.associateWith { lay(Facing.FRONT, it) },
      side = listOf(Eyes.DOT, Eyes.SHUT).associateWith { lay(Facing.SIDE, it) },
      back = lay(Facing.BACK, Eyes.DOT),
    )
  }

  private const val S = 100f

  // theme/logo.json shadow.ratio: the block behind is offset by this share of S.
  private const val SHADOW = 0.12f

  // figure.ts SIDE_W: side on, a block is narrower.
  private const val SIDE_W = 0.82f

  // eyes.ts EYE and OPEN.
  private const val EYE_W = 0.25f
  private const val EYE_H = 0.29f
  private const val EYE_GAP = 0.08f
  private const val EYE_TOP = 0.29f
  private const val EYE_WIDE = 1.24f
  private val OPEN = mapOf(Eyes.DOT to 1f, Eyes.WIDE to 1f, Eyes.SLEEPY to 0.4f, Eyes.SHUT to 0.15f, Eyes.HAPPY to 0.34f)

  fun lay(facing: Facing, eyes: Eyes): Figure {
    val o = S * SHADOW
    val w = S * (if (facing == Facing.SIDE) SIDE_W else 1f)
    val h = S
    // Side on (facing right), the block behind shows on the side it turns from.
    val ox = if (facing == Facing.SIDE) -o else o
    val left = -(w + o) / 2 + (if (ox < 0) o else 0f)
    val top = -h - o
    val front = Box(left, top, w, h)
    val back = Box(left + ox, top + o, w, h)
    // Turned away, the amber block is the nearer one.
    val (near, far) = if (facing == Facing.BACK) Ink.AMBER to Ink.RED else Ink.RED to Ink.AMBER
    val laid = if (facing == Facing.BACK) emptyList() else eyes(front, eyes, side = facing == Facing.SIDE)
    val marks = if (facing == Facing.BACK) vent(front) else emptyList()
    val x0 = minOf(front.x, back.x)
    val y0 = minOf(front.y, back.y)
    val bounds = Box(x0, y0, maxOf(front.right, back.right) - x0, maxOf(front.bottom, back.bottom) - y0)
    return Figure(front, near, back, far, laid, marks, bounds)
  }

  private fun eyes(front: Box, eyes: Eyes, side: Boolean): List<Eye> {
    val ew = S * EYE_W
    val full = S * EYE_H * (if (eyes == Eyes.WIDE) EYE_WIDE else 1f)
    val gap = S * EYE_GAP
    val ey = front.y + S * EYE_TOP
    val eh = full * OPEN.getValue(eyes)
    // Shut and sleepy lids close from the top; a happy squint keeps the top.
    val top = if (eyes == Eyes.HAPPY) ey else ey + full - eh
    val xs = if (side) listOf(front.right - ew * 1.3f) else listOf(front.x + (front.w - (ew * 2 + gap)) / 2, front.x + (front.w + gap) / 2)
    val gx = if (side) 0.8f else 0f
    return xs.map { x ->
      val pupil = if (eh > full * 0.5f) Box(x + ew * 0.25f + gx * ew * 0.22f, top + eh * 0.3f, ew * 0.5f, full * (if (eyes == Eyes.WIDE) 0.32f else 0.43f)) else null
      Eye(Box(x, ey, ew, full), Box(x, top, ew, eh), pupil)
    }
  }

  // figure.ts VENT: three dark slits where the face would be.
  private fun vent(front: Box): List<Drawn> = (0..2).map { k ->
    Drawn.Rect(Box(front.x + 0.28f * front.w, front.y + 0.36f * front.h + k * 0.12f * S, 0.44f * front.w, 0.05f * S), Painted(Ink.DARK, null, 0f, 0.35f))
  }
}
