package com.phonecando.runner.uiauto.overlay

import android.content.Context
import com.phonecando.runner.R

// The overlay's colours: theme/tokens.json's roles as resources
// (theme.gradle), light or dark as the context reads them (GlassScheme:
// the app's own setting); darkBg, the mascot's dark ink, is the dark
// theme's bg in both. Read again with [load] when the theme changes while
// the glass is up; everything that draws reads them as it draws.
internal class Palette(context: Context) {
  var primary = 0
    private set
  var secondary = 0
    private set
  var panel = 0
    private set
  var fg = 0
    private set
  var muted = 0
    private set
  var onPrimary = 0
    private set
  var line = 0
    private set
  var darkBg = 0
    private set

  init {
    load(context)
  }

  fun load(context: Context) {
    primary = context.getColor(R.color.theme_primary)
    secondary = context.getColor(R.color.theme_secondary)
    panel = context.getColor(R.color.theme_panel)
    fg = context.getColor(R.color.theme_fg)
    muted = context.getColor(R.color.theme_muted)
    onPrimary = context.getColor(R.color.theme_onPrimary)
    line = context.getColor(R.color.theme_lineStrong)
    darkBg = context.getColor(R.color.theme_darkBg)
  }
}
