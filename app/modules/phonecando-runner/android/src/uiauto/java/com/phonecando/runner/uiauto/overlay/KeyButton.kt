package com.phonecando.runner.uiauto.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.widget.TextView

// A button in the app's look (AppButton, the site's `.btn`): square, mono
// uppercase, a hard amber shadow 2 dp down and right; a press sinks it
// into its shadow so it clicks like a key. MAIN is filled red, OTHER is
// outlined on the card, SMALL is bare words with no key.
@SuppressLint("ViewConstructor", "AppCompatCustomView")
internal class KeyButton(context: Context, private val palette: Palette, private val look: Look, mono: Typeface?) : TextView(context) {
  enum class Look { MAIN, OTHER, SMALL }

  private val dp = resources.displayMetrics.density
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp
  }
  private val shadow = SHADOW_DP * dp

  init {
    typeface = Typeface.create(mono ?: Typeface.MONOSPACE, if (look == Look.SMALL) Typeface.NORMAL else Typeface.BOLD)
    isAllCaps = true
    letterSpacing = 0.1f
    gravity = Gravity.CENTER
    setTextSize(TypedValue.COMPLEX_UNIT_SP, if (look == Look.SMALL) 11f else 12f)
    setTextColor(
      when (look) {
        Look.MAIN -> palette.onPrimary
        Look.OTHER -> palette.fg
        Look.SMALL -> palette.muted
      },
    )
    val (h, v) = if (look == Look.SMALL) 8 to 6 else 16 to 11
    // Room for the shadow on the right and below, so a sunk key stays inside.
    setPadding(px(h), px(v), px(h) + shadow.toInt(), px(v) + shadow.toInt())
    minHeight = if (look == Look.SMALL) 0 else px(MIN_H_DP)
  }

  override fun setPressed(pressed: Boolean) {
    super.setPressed(pressed)
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    if (look == Look.SMALL) {
      super.onDraw(canvas)
      return
    }
    val sunk = isPressed
    val right = width - shadow
    val bottom = height - shadow
    if (!sunk) {
      fill.color = palette.secondary
      canvas.drawRect(shadow, shadow, width.toFloat(), height.toFloat(), fill)
    }
    canvas.save()
    if (sunk) canvas.translate(shadow, shadow)
    if (look == Look.MAIN) {
      fill.color = palette.primary
      canvas.drawRect(0f, 0f, right, bottom, fill)
    } else {
      fill.color = palette.panel
      canvas.drawRect(0f, 0f, right, bottom, fill)
      edge.color = palette.line
      canvas.drawRect(dp / 2, dp / 2, right - dp / 2, bottom - dp / 2, edge)
    }
    super.onDraw(canvas)
    canvas.restore()
  }

  private fun px(dps: Int) = (dps * dp).toInt()

  private companion object {
    const val SHADOW_DP = 2f
    const val MIN_H_DP = 40
  }
}
