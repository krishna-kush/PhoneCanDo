package com.phonecando.runner.uiauto.overlay

import android.content.Context
import android.view.Gravity

// TEMP: the looks to try on the phone. A long press on the pill (or the
// badge) switches to the next one, kept across drives. Once one is picked,
// delete the others and this switch.
internal enum class OverlayLook(val glow: Boolean, val gravity: Int, val badge: Boolean) {
  /** A breathing glow round the edge, the pill at the top. */
  GLOW_TOP(glow = true, gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL, badge = false),

  /** A thin steady line round the edge, the pill at the bottom. */
  FRAME_BOTTOM(glow = false, gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL, badge = false),

  /** The glow, and only the face in the top corner until you tap it. */
  GLOW_BADGE(glow = true, gravity = Gravity.TOP or Gravity.END, badge = true),
  ;

  companion object {
    private const val PREFS = "phonecando_overlay"
    private const val KEY = "look"

    fun current(context: Context): OverlayLook {
      val name = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      return entries.firstOrNull { it.name == name } ?: GLOW_TOP
    }

    fun next(context: Context): OverlayLook {
      val next = entries[(current(context).ordinal + 1) % entries.size]
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, next.name).apply()
      return next
    }
  }
}
