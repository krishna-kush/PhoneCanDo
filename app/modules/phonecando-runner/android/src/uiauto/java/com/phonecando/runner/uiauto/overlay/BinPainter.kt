package com.phonecando.runner.uiauto.overlay

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.walls.BinSpot

// The bin while you drag a stopped agent's mascot (presence/glass/walls/
// Bin): a key box in the card's look (square panel, red edge, hard amber
// shadow) with an × on it and LEAVE IT under it. It pops in; with the
// mascot over it, it swells and goes red, the × in the red's ink.
internal class BinPainter(private val palette: Palette, private val dp: Float, typeface: Typeface?) {
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 1.5f * dp
  }
  private val cross = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 3f * dp
    strokeCap = Paint.Cap.SQUARE
  }
  private val words = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textAlign = Paint.Align.CENTER
    textSize = 11f * dp
    letterSpacing = 0.12f
    this.typeface = typeface ?: Typeface.MONOSPACE
  }
  private val box = RectF()

  /** [spot] [shownMs] after it came up; [armed]: the mascot is over it. */
  fun draw(canvas: Canvas, spot: BinSpot, shownMs: Long, armed: Boolean) {
    val pop = Ease.out(Ease.clamp(shownMs / POP_MS))
    val half = spot.half * pop * (if (armed) ARMED else 1f)
    if (half <= 0f) return
    val shadow = SHADOW_DP * dp
    box.set(spot.x - half, spot.y - half, spot.x + half, spot.y + half)
    canvas.save()
    canvas.translate(shadow, shadow)
    fill.color = palette.secondary
    canvas.drawRect(box, fill)
    canvas.restore()
    fill.color = if (armed) palette.primary else palette.panel
    canvas.drawRect(box, fill)
    edge.color = palette.primary
    canvas.drawRect(box, edge)
    cross.color = if (armed) palette.onPrimary else palette.fg
    val arm = half * 0.38f
    canvas.drawLine(spot.x - arm, spot.y - arm, spot.x + arm, spot.y + arm, cross)
    canvas.drawLine(spot.x - arm, spot.y + arm, spot.x + arm, spot.y - arm, cross)
    words.color = palette.fg
    words.alpha = (pop * 255).toInt()
    canvas.drawText(LABEL, spot.x, spot.y + half + shadow + 16f * dp, words)
  }

  private companion object {
    const val LABEL = "LEAVE IT"
    const val POP_MS = 180f
    const val ARMED = 1.15f
    const val SHADOW_DP = 3f
  }
}
