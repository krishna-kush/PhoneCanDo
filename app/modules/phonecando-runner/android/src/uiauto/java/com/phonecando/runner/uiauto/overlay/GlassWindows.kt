package com.phonecando.runner.uiauto.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.WindowManager.LayoutParams
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.walls.Area

// The glass's three windows, all accessibility overlays of our service
// (no draw-over permission; Android lets touches through them to the app
// below): the stage over the whole screen, which never takes a touch; the
// grip, a see-through spot just over the mascot where it rests; the card
// beside it; and the watch, one see-through pixel that hears of every
// touch elsewhere (TouchWatch). The stage lies over the grip and the card,
// so the mascot's speech shows in front of its card. All laid out in the
// screen's own pixels, bars and cutouts included, the same places the
// agent's touches use.
// Main thread.
internal class GlassWindows(private val context: Context) {
  private val manager = context.getSystemService(WindowManager::class.java)

  var stage: StageView? = null
    private set
  var grip: GripView? = null
    private set
  var card: CardView? = null
    private set
  private var watch: TouchWatch? = null
  private var gripParams: LayoutParams? = null
  private var cardParams: LayoutParams? = null
  private var watchParams: LayoutParams? = null
  private var touchable = true

  val open: Boolean get() = stage != null

  /** Adds the four windows, the grip and card not shown yet; false when Android refused them. */
  fun open(stage: StageView, grip: GripView, card: CardView, watch: TouchWatch): Boolean {
    val gp = params("PhoneCanDo mascot", LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, touch = true)
    val cp = params("PhoneCanDo mascot card", LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, touch = true)
    val wp = params("PhoneCanDo touch watch", 1, 1, touch = true, outside = true)
    grip.visibility = View.GONE
    card.visibility = View.GONE
    val added = mutableListOf<View>()
    try {
      manager.addView(grip, gp)
      added += grip
      manager.addView(card, cp)
      added += card
      // Over the card, so what the mascot says shows in front of it; it
      // never takes a touch, so taps still reach the card and the grip.
      manager.addView(stage, params("PhoneCanDo glass", LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, touch = false))
      added += stage
      manager.addView(watch, wp)
      added += watch
    } catch (e: Exception) {
      Log.w(TAG, "glass failed", e)
      added.forEach { runCatching { manager.removeViewImmediate(it) } }
      return false
    }
    this.stage = stage
    this.grip = grip
    this.card = card
    this.watch = watch
    gripParams = gp
    cardParams = cp
    watchParams = wp
    return true
  }

  fun close() {
    listOfNotNull(stage, grip, card, watch).forEach { runCatching { manager.removeViewImmediate(it) } }
    stage = null
    grip = null
    card = null
    watch = null
    gripParams = null
    cardParams = null
    watchParams = null
  }

  /** The grip over [area]; null puts it away. */
  fun grip(area: Area?) {
    val view = grip ?: return
    val params = gripParams ?: return
    if (area == null) {
      view.visibility = View.GONE
      return
    }
    // Wider than the mascot it covers, so a tap near it never lands on the page.
    val density = context.resources.displayMetrics.density
    val pad = GRIP_PAD_DP * density
    val least = GRIP_MIN_DP * density
    val w = maxOf(area.right - area.left + pad * 2, least)
    val h = maxOf(area.bottom - area.top + pad * 2, least)
    params.x = ((area.left + area.right) / 2 - w / 2).toInt()
    params.y = ((area.top + area.bottom) / 2 - h / 2).toInt()
    params.width = w.toInt()
    params.height = h.toInt()
    view.visibility = View.VISIBLE
    update(view, params)
  }

  /** The grip centred on [p], following a finger. */
  fun gripAt(p: Pt) {
    val view = grip ?: return
    val params = gripParams ?: return
    params.x = (p.x - params.width / 2f).toInt()
    params.y = (p.y - params.height / 2f).toInt()
    update(view, params)
  }

  /** How big the card is with its words now, at most [maxW] wide. */
  fun cardSize(maxW: Int): Pair<Int, Int> {
    val view = card ?: return 0 to 0
    view.measure(View.MeasureSpec.makeMeasureSpec(maxW, View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
    return view.measuredWidth to view.measuredHeight
  }

  /** The card's top-left at [at]; null puts it away. */
  fun card(at: Pt?) {
    val view = card ?: return
    val params = cardParams ?: return
    if (at == null) {
      view.visibility = View.GONE
      return
    }
    params.x = at.x.toInt()
    params.y = at.y.toInt()
    val coming = view.visibility != View.VISIBLE
    view.visibility = View.VISIBLE
    update(view, params)
    if (coming) view.post { view.pop() }
  }

  /** Where a touch at ([x], [y]) landed on the grip or card, ours: no touch of yours on the screen. */
  fun ours(x: Float, y: Float): Boolean = listOf(grip to gripParams, card to cardParams).any { (view, p) ->
    view != null && p != null && view.visibility == View.VISIBLE &&
      x >= p.x && x < p.x + view.width && y >= p.y && y < p.y + view.height
  }

  /**
   * Lets touches through the grip and the card (false) while the agent's
   * own touch lands, or takes them again; the watch hears nothing meanwhile.
   */
  fun touchable(on: Boolean): List<View> {
    touchable = on
    val changed = mutableListOf<View>()
    for ((view, params) in listOf(grip to gripParams, card to cardParams, watch to watchParams)) {
      if (view == null || params == null) continue
      params.flags = flags(on, outside = view === watch)
      update(view, params)
      changed += view
    }
    return changed
  }

  fun views(): List<View> = listOfNotNull(stage, grip, card, watch)

  private fun update(view: View, params: LayoutParams) {
    runCatching { manager.updateViewLayout(view, params) }
  }

  private fun flags(touch: Boolean, outside: Boolean = false) =
    LayoutParams.FLAG_NOT_FOCUSABLE or LayoutParams.FLAG_LAYOUT_IN_SCREEN or LayoutParams.FLAG_LAYOUT_NO_LIMITS or
      (if (touch) 0 else LayoutParams.FLAG_NOT_TOUCHABLE) or
      (if (outside) LayoutParams.FLAG_NOT_TOUCH_MODAL or LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH else 0)

  private fun params(title: String, w: Int, h: Int, touch: Boolean, outside: Boolean = false) = LayoutParams(
    w,
    h,
    LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
    flags(touch && touchable, outside),
    PixelFormat.TRANSLUCENT,
  ).apply {
    this.title = title
    gravity = android.view.Gravity.TOP or android.view.Gravity.START
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      layoutInDisplayCutoutMode = LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      fitInsetsTypes = 0
    } else {
      layoutInDisplayCutoutMode = LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoOverlay"
    const val GRIP_PAD_DP = 14f
    const val GRIP_MIN_DP = 72f
  }
}
