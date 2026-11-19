package com.phonecando.runner.uiauto.overlay

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.walls.Area
import com.phonecando.runner.presence.glass.walls.Beside
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import kotlin.math.sin

// The mascot's speech bubble beside it, toward the middle of the screen,
// in the app's look: a square speech box with a red edge, a hard amber
// shadow and a blocky tail at the mascot. Its status (two lines at most)
// types itself out in the app's mono face behind a blinking red cursor,
// and the box pops each time the words change; thinking is three amber
// blocks hopping in turn. What it says to you (SAY: a button of yours did
// something) is a red box, so it reads as the mascot talking.
internal class BubblePainter(private val palette: Palette, private val dp: Float, sp: Float, mono: Typeface?) {
  enum class Voice { STATUS, SAY }

  private val text = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = TEXT_SP * sp
    typeface = mono ?: Typeface.MONOSPACE
  }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = EDGE_DP * dp
    strokeJoin = Paint.Join.MITER
  }
  private val box = RectF()
  private val shape = Path()
  private val tail = Path()
  private var full: StaticLayout? = null
  private var shown: StaticLayout? = null
  private var shownChars = -1

  // The words now and when they came: the typing and the pop count from there.
  private var words: String? = null
  private var since = 0L

  /** [dots]: thinking, the blocks hop; [now] is the frame's time (uptime ms). */
  fun draw(canvas: Canvas, room: Room, area: Area, wall: Wall, said: String?, dots: Boolean, voice: Voice, now: Long) {
    if (said == null && !dots) {
      words = null
      return
    }
    if (said != words) {
      words = said
      since = now
      full = said?.let { layout(it, it.length) }
      shown = null
      shownChars = -1
    }
    val age = now - since
    val layout = full
    val pad = PAD_DP * dp
    val d = DOT_DP * dp
    val dotsW = if (dots) d * 3 + d * 0.7f * 2 else 0f
    val between = if (layout != null && dots) pad * 0.8f else 0f
    val textW = layout?.let { (0 until it.lineCount).maxOf { i -> it.getLineWidth(i) } + cursorW() } ?: 0f
    val textH = layout?.height?.toFloat() ?: 0f
    val w = textW + between + dotsW + pad * 2
    val h = maxOf(textH, d * 2) + pad * 1.3f
    val gap = GAP_DP * dp
    val at = Beside.place(room, area, wall, w + SHADOW_DP * dp, h + SHADOW_DP * dp, gap)
    box.set(at.x, at.y, at.x + w, at.y + h)
    val tip = outline(area, wall)

    canvas.save()
    // A pop as new words come: out of the tail's tip, a little past full size and back.
    val pop = if (age < POP_MS) Ease.clamp(age.toFloat() / POP_MS) else 1f
    val s = if (pop < 1f) 0.7f + 0.3f * overshoot(pop) else 1f
    canvas.scale(s, s, tip.first, tip.second)

    val shadow = SHADOW_DP * dp
    canvas.save()
    canvas.translate(shadow, shadow)
    fill.color = palette.secondary
    canvas.drawPath(shape, fill)
    canvas.restore()
    fill.color = if (voice == Voice.SAY) palette.primary else palette.panel
    canvas.drawPath(shape, fill)
    edge.color = palette.primary
    canvas.drawPath(shape, edge)

    if (said != null && layout != null) {
      // Typed out a letter at a time; what it says to you comes at once.
      val chars = if (voice == Voice.SAY) said.length else (age / CHAR_MS).toInt().coerceAtMost(said.length)
      val part = typed(said, chars)
      text.color = if (voice == Voice.SAY) palette.onPrimary else palette.fg
      val x = at.x + pad
      val y = at.y + (h - textH) / 2
      canvas.save()
      canvas.translate(x, y)
      part.draw(canvas)
      canvas.restore()
      if (voice == Voice.STATUS && cursorOn(chars < said.length, age - said.length * CHAR_MS)) {
        val line = (part.lineCount - 1).coerceAtLeast(0)
        val cx = x + (if (chars == 0) 0f else part.getLineWidth(line)) + dp
        val top = y + part.getLineTop(line) + dp
        val bottom = y + part.getLineBottom(line) - dp
        fill.color = palette.primary
        canvas.drawRect(cx, top, cx + cursorW() - dp * 2, bottom, fill)
      }
    }
    if (dots) {
      val cy = at.y + h / 2 + d / 2
      var cx = at.x + pad + textW + between
      for (i in 0..2) {
        val p = ((now + i * HOP_MS / 4) % HOP_MS).toFloat() / HOP_MS
        val lift = sin(Ease.span(p, 0f, 0.5f) * Math.PI.toFloat()) * d * 1.1f
        fill.color = if (voice == Voice.SAY) palette.onPrimary else palette.secondary
        canvas.drawRect(cx, cy - d - lift, cx + d, cy - lift, fill)
        cx += d * 1.7f
      }
    }
    canvas.restore()
  }

  // The box and its tail as one shape, so the edge runs round both; the
  // tail's tip, for the pop to grow from.
  private fun outline(area: Area, wall: Wall): Pair<Float, Float> {
    val t = TAIL_DP * dp
    shape.reset()
    shape.addRect(box, Path.Direction.CW)
    tail.reset()
    val tip: Pair<Float, Float>
    when (wall) {
      Wall.LEFT, Wall.RIGHT -> {
        val y = (area.top + (area.bottom - area.top) * 0.35f).coerceIn(box.top + t, box.bottom - t)
        val x = if (wall == Wall.LEFT) box.left else box.right
        val tx = if (wall == Wall.LEFT) x - t else x + t
        // Blocky: a step out from the edge rather than a soft point.
        tail.moveTo(x, y - t * 0.7f)
        tail.lineTo(tx, y)
        tail.lineTo(x, y + t * 0.2f)
        tip = tx to y
      }
      Wall.TOP, Wall.BOTTOM -> {
        val x = area.midX.coerceIn(box.left + t, box.right - t)
        val y = if (wall == Wall.TOP) box.top else box.bottom
        val ty = if (wall == Wall.TOP) y - t else y + t
        tail.moveTo(x - t * 0.7f, y)
        tail.lineTo(x, ty)
        tail.lineTo(x + t * 0.2f, y)
        tip = x to ty
      }
    }
    tail.close()
    shape.op(tail, Path.Op.UNION)
    return tip
  }

  // The first [chars] letters, laid out as wide as the whole words so the lines break the same.
  private fun typed(words: String, chars: Int): StaticLayout {
    if (chars == shownChars) shown?.let { return it }
    val made = if (chars >= words.length) full!! else layout(words, chars)
    shown = made
    shownChars = chars
    return made
  }

  private fun layout(words: String, chars: Int): StaticLayout {
    val max = (MAX_DP * dp).toInt()
    val width = minOf(max, StaticLayout.getDesiredWidth(words, text).toInt() + 1)
    return StaticLayout.Builder.obtain(words, 0, chars, text, width)
      .setAlignment(Layout.Alignment.ALIGN_NORMAL)
      .setMaxLines(2)
      .setEllipsize(TextUtils.TruncateAt.END)
      .setIncludePad(false)
      .build()
  }

  private fun cursorW() = text.textSize * 0.55f

  // Solid while it types; then [BLINKS] whole blinks counted from the last
  // letter, on then off each, so it always stops on an off, never cut short.
  private fun cursorOn(typing: Boolean, sinceTyped: Long): Boolean {
    if (typing) return true
    val phase = sinceTyped / BLINK_MS
    return phase < BLINKS * 2 && phase % 2 == 0L
  }

  // Past 1 and back, like the card's pop.
  private fun overshoot(p: Float): Float {
    val k = 2.2f
    val q = p - 1
    return q * q * ((k + 1) * q + k) + 1
  }

  private companion object {
    const val TEXT_SP = 12f
    const val MAX_DP = 200f
    const val PAD_DP = 10f
    const val DOT_DP = 5f
    const val GAP_DP = 8f
    const val TAIL_DP = 9f
    const val EDGE_DP = 1.5f
    const val SHADOW_DP = 2f
    const val POP_MS = 220L
    const val CHAR_MS = 28L
    const val BLINK_MS = 450L
    const val BLINKS = 3
    const val HOP_MS = 900L
  }
}
