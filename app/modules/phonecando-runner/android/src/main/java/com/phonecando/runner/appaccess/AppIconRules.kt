package com.phonecando.runner.appaccess

// Where an app's icon is kept once drawn (AppIcons), and when that copy
// still holds: one PNG per package and size in the app's cache, drawn again
// once the app was updated after it (its icon may have changed). Pure.
internal object AppIconRules {
  const val DIR = "app-icons"
  const val MIN_PX = 16
  const val MAX_PX = 512

  fun sizePx(asked: Int): Int = asked.coerceIn(MIN_PX, MAX_PX)

  // Null for anything that is not a package name, so no path is ever made
  // from other words.
  fun fileName(pkg: String, asked: Int): String? =
    if (AppAccessRules.isPackageName(pkg)) "$pkg-${sizePx(asked)}.png" else null

  // The kept copy was drawn (not empty) no earlier than the app's last update.
  fun fresh(length: Long, modifiedMs: Long, appUpdatedMs: Long): Boolean = length > 0 && modifiedMs >= appUpdatedMs
}
