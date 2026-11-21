package com.phonecando.runner.autooff

import android.content.Context
import com.phonecando.runner.PhoneCanDoServeService

// Settings → Phone control's Auto off, kept natively so the accessibility
// service holds to it with no JS around, and the mark that Auto off was
// what turned the service off (the app's lines and the bridge's 503 say
// so), cleared when the service connects again. On until the user turns it
// off: control that nobody is using goes away by itself, and bank apps
// open. Full builds only use it.
object AutoOff {
  private const val KEY_ON = "a11y_auto_off"
  private const val KEY_TURNED_OFF = "a11y_auto_off_turned_off"

  fun isOn(context: Context): Boolean = prefs(context).getBoolean(KEY_ON, true)

  fun set(context: Context, on: Boolean) {
    prefs(context).edit().putBoolean(KEY_ON, on).apply()
  }

  /** Auto off turned the service off, and it has not run since. */
  fun turnedOff(context: Context): Boolean = prefs(context).getBoolean(KEY_TURNED_OFF, false)

  fun markTurnedOff(context: Context) {
    prefs(context).edit().putBoolean(KEY_TURNED_OFF, true).apply()
  }

  fun clearTurnedOff(context: Context) {
    prefs(context).edit().remove(KEY_TURNED_OFF).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
}
