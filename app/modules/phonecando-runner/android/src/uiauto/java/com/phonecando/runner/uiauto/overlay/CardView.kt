package com.phonecando.runner.uiauto.overlay

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.animation.OvershootInterpolator
import android.widget.LinearLayout
import android.widget.TextView
import com.phonecando.runner.R
import com.phonecando.runner.presence.glass.scene.Button
import com.phonecando.runner.presence.glass.scene.CardCopy

// The card beside the mascot, in the app's look: a speech box (CardBack,
// its tail at the mascot) with a small amber kicker and a live light, a
// title, a line, and its buttons as the app's keys (KeyButton): the first
// filled, the others outlined, a small one bare words under the rest. The
// words are GlassCopy's. It pops out of the mascot's side as it shows.
@SuppressLint("ViewConstructor")
internal class CardView(context: Context, private val palette: Palette, private val press: (Button) -> Unit) : LinearLayout(context) {
  private val dp = resources.displayMetrics.density
  private val mono: Typeface? = runCatching { resources.getFont(R.font.geist_mono_regular) }.getOrNull()
  private val back = CardBack(palette, dp)
  private val light = LiveLight(context, palette)
  private val kicker = TextView(context).apply {
    typeface = Typeface.create(mono ?: Typeface.MONOSPACE, Typeface.BOLD)
    isAllCaps = true
    letterSpacing = 0.14f
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
    setTextColor(palette.secondary)
    maxLines = 1
  }
  private val title = text(15f, palette.fg, bold = true, lines = 3)
  private val line = text(13f, palette.muted, bold = false, lines = 3)
  private val row = LinearLayout(context).apply {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
  }
  private val small = LinearLayout(context).apply {
    orientation = HORIZONTAL
    gravity = Gravity.END
  }
  private var shown: CardCopy? = null

  init {
    orientation = VERTICAL
    background = back
    val m = back.margin.toInt()
    setPadding(m + px(14), m + px(11), m + px(14) + px(2), m + px(12) + px(2))
    val top = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(light, LayoutParams(px(6), px(6)).apply { marginEnd = px(7) })
      addView(kicker)
    }
    addView(top)
    addView(title, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(6) })
    addView(line, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(2) })
    addView(row, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(12) })
    addView(small, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(4) })
  }

  fun bind(copy: CardCopy) {
    if (copy == shown) return
    shown = copy
    kicker.text = copy.kicker
    title.text = copy.title
    line.text = copy.line
    line.visibility = if (copy.line == null) GONE else VISIBLE
    row.removeAllViews()
    small.removeAllViews()
    copy.buttons.forEachIndexed { i, b ->
      if (b.small) {
        small.addView(key(b, KeyButton.Look.SMALL))
      } else {
        val params = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { if (row.childCount > 0) marginStart = px(6) }
        row.addView(key(b, if (i == 0) KeyButton.Look.MAIN else KeyButton.Look.OTHER), params)
      }
    }
    small.visibility = if (small.childCount == 0) GONE else VISIBLE
  }

  /** The theme changed: its words and keys take the palette's colours again (its back reads them as it draws). */
  fun recolor() {
    kicker.setTextColor(palette.secondary)
    title.setTextColor(palette.fg)
    line.setTextColor(palette.muted)
    val copy = shown
    shown = null
    copy?.let(::bind)
    invalidate()
  }

  /** Points the tail at the mascot: out of [side], [along] px from the card's own edge. */
  fun tail(side: CardBack.Side, along: Float) {
    back.tail = side to along
  }

  /** Pops out of the tail's side, as it comes up. */
  fun pop() {
    val (side, along) = back.tail ?: (CardBack.Side.RIGHT to height / 2f)
    pivotX = when (side) {
      CardBack.Side.LEFT -> 0f
      CardBack.Side.RIGHT -> width.toFloat()
      else -> along
    }
    pivotY = when (side) {
      CardBack.Side.TOP -> 0f
      CardBack.Side.BOTTOM -> height.toFloat()
      else -> along
    }
    scaleX = 0.6f
    scaleY = 0.6f
    alpha = 0f
    animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(POP_MS).setInterpolator(OvershootInterpolator(2.2f)).start()
  }

  private fun key(b: Button, look: KeyButton.Look) = KeyButton(context, palette, look, mono).apply {
    text = b.label
    contentDescription = b.says
    setOnClickListener { press(b) }
  }

  private fun text(sp: Float, color: Int, bold: Boolean, lines: Int) = TextView(context).apply {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    setTextColor(color)
    if (bold) setTypeface(typeface, Typeface.BOLD)
    maxLines = lines
    ellipsize = TextUtils.TruncateAt.END
    maxWidth = px(MAX_DP)
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
  }

  private fun px(dps: Int) = (dps * dp).toInt()

  private companion object {
    const val MAX_DP = 240
    const val POP_MS = 240L
  }
}

// The kicker's live light: a small red square that breathes, the site's sign of something live.
@SuppressLint("ViewConstructor")
private class LiveLight(context: Context, private val palette: Palette) : View(context) {
  private val paint = Paint()
  private var breath: ValueAnimator? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    breath = ValueAnimator.ofFloat(1f, 0.35f).apply {
      duration = 900
      repeatMode = ValueAnimator.REVERSE
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener {
        alpha = it.animatedValue as Float
      }
      start()
    }
  }

  override fun onDetachedFromWindow() {
    breath?.cancel()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    paint.color = palette.primary
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }
}
