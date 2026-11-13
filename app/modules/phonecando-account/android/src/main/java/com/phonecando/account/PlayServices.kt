package com.phonecando.account

import android.content.Context
import android.content.pm.PackageManager

/**
 * Whether Google Play services is on the phone and enabled: Sign in with
 * Google is served by it. Read from the package list (the manifest's
 * <queries> makes it visible), so the app needs no Play services library
 * for the check.
 */
object PlayServices {
  private const val PACKAGE = "com.google.android.gms"

  fun installed(context: Context): Boolean = try {
    context.packageManager.getApplicationInfo(PACKAGE, 0).enabled
  } catch (_: PackageManager.NameNotFoundException) {
    false
  }
}
