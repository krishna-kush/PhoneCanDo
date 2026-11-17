package com.phonecando.runner.uiauto.overlay

import android.content.Context
import com.phonecando.runner.R

// The overlay's colours: theme/tokens.json's roles as resources
// (theme.gradle), light or dark with the phone.
internal class Palette(context: Context) {
  val primary = context.getColor(R.color.theme_primary)
  val secondary = context.getColor(R.color.theme_secondary)
  val panel = context.getColor(R.color.theme_panel)
  val fg = context.getColor(R.color.theme_fg)
  val muted = context.getColor(R.color.theme_muted)
  val onPrimary = context.getColor(R.color.theme_onPrimary)
  val line = context.getColor(R.color.theme_lineStrong)
}
