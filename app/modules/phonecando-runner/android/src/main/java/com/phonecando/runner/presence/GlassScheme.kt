package com.phonecando.runner.presence

import android.content.Context
import android.content.res.Configuration

// Light or dark for the mascot on the glass, as the app's own theme
// setting has it (System, Light or Dark, which JS pushes with
// setGlassScheme), not just the phone's: with the app on Light and the
// phone on Dark the glass must be light too; on System (or until the app
// ever says) it is the phone's. Kept in prefs, so a drive with no app
// screen up since a restart still has it. A change tells [listener] (the
// glass, which recolours at once).
object GlassScheme {
  private const val PREFS = "phonecando_glass"
  private const val KEY = "scheme"

  @Volatile
  var listener: (() -> Unit)? = null

  /** [mode]: "system", "light" or "dark"; anything else counts as system. */
  fun set(context: Context, mode: String) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val next = if (mode == "light" || mode == "dark") mode else "system"
    if ((prefs.getString(KEY, null) ?: "system") == next) return
    prefs.edit().putString(KEY, next).apply()
    listener?.let { runCatching { it() } }
  }

  /** [context] as the glass draws it: its resources read the app's light or dark colours. */
  fun themed(context: Context): Context {
    val dark = when (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)) {
      "dark" -> true
      "light" -> false
      else -> return context
    }
    val config = Configuration(context.resources.configuration)
    val night = if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
    config.uiMode = (config.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or night
    return context.createConfigurationContext(config)
  }
}
