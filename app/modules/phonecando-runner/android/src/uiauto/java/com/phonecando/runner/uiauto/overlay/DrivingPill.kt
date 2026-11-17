package com.phonecando.runner.uiauto.overlay

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

// The pill: the driver's face, its name, "is driving your phone" and Take
// back. After Take back it says the phone is yours until the overlay goes.
// The badge look starts as the face alone and opens on a tap, closing again
// a few seconds later. TEMP: a long press switches looks (OverlayLook).
internal class DrivingPill(
  context: Context,
  private val palette: Palette,
  private val look: OverlayLook,
  private val onTakeBack: () -> Unit,
  private val onSwitchLook: () -> Unit,
) : LinearLayout(context) {
  private val dp = resources.displayMetrics.density
  private val face = FaceView(context, palette)
  private val title = text(14f, palette.fg, bold = true)
  private val line = text(12f, palette.muted, bold = false)
  private val words = LinearLayout(context).apply {
    orientation = VERTICAL
    addView(title)
    addView(line)
  }
  private val button = TextView(context).apply {
    text = "Take back"
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    setTypeface(typeface, Typeface.BOLD)
    setTextColor(palette.onPrimary)
    background = GradientDrawable().apply {
      setColor(palette.primary)
      cornerRadius = 999 * dp
    }
    setPadding(px(14), px(8), px(14), px(8))
    setOnClickListener { takeBack() }
  }
  private val close = Runnable { setOpen(false) }

  /** Take back was pressed: the overlay lingers a moment saying so. */
  var returned = false
    private set

  private var open = !look.badge
  private var name = ""

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    background = GradientDrawable().apply {
      setColor(palette.panel)
      setStroke(px(1), palette.line)
      cornerRadius = 999 * dp
    }
    setPadding(px(8), px(8), px(8), px(8))
    addView(face, LayoutParams(px(FACE_DP), px(FACE_DP)))
    addView(words, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginStart = px(10) })
    addView(button, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginStart = px(12) })
    setOnClickListener { if (look.badge && !returned) setOpen(!open) }
    setOnLongClickListener {
      onSwitchLook()
      true
    }
    setOpen(open)
  }

  fun bind(driver: String) {
    if (driver == name && !returned) return
    name = driver
    returned = false
    title.text = driver
    line.text = "is driving your phone"
    button.visibility = VISIBLE
    contentDescription = "$driver is driving your phone"
    button.contentDescription = "Take the phone back from $driver"
    setOpen(open)
  }

  private fun takeBack() {
    returned = true
    title.text = "Phone is yours"
    line.text = "$name stopped driving"
    button.visibility = GONE
    contentDescription = "$name stopped driving. Phone is yours"
    onTakeBack()
  }

  private fun setOpen(next: Boolean) {
    open = next
    val shown = if (next) VISIBLE else GONE
    words.visibility = shown
    if (!returned) button.visibility = shown
    removeCallbacks(close)
    if (look.badge && next) postDelayed(close, BADGE_OPEN_MS)
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(close)
    super.onDetachedFromWindow()
  }

  private fun text(sp: Float, color: Int, bold: Boolean) = TextView(context).apply {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    setTextColor(color)
    if (bold) setTypeface(typeface, Typeface.BOLD)
    maxLines = 1
    ellipsize = TextUtils.TruncateAt.END
    maxWidth = px(MAX_TEXT_DP)
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  private fun px(dps: Int) = (dps * dp).toInt()

  private companion object {
    const val FACE_DP = 30
    const val MAX_TEXT_DP = 170
    const val BADGE_OPEN_MS = 4_000L
  }
}
