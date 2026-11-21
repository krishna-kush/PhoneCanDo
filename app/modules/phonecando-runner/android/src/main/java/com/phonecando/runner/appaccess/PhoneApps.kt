package com.phonecando.runner.appaccess

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

// What the phone says about its apps, for the app-access question: an
// app's name, the app a link opens in, and the apps nobody is asked about
// (PhoneCanDo itself and the default home screen, read each time as the
// user may change it).
internal class PhoneApps(context: Context) {
  private val own = context.packageName
  private val pm = context.packageManager

  fun exempt(pkg: String): Boolean = pkg == own || isHome(pkg)

  fun isHome(pkg: String): Boolean = pkg == homeScreen()

  // Falls back to the package when Android hides the app from us.
  fun label(pkg: String): String = try {
    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString().ifBlank { pkg }
  } catch (_: Exception) {
    pkg
  }

  // The app Android would hand this link to; null when it can't say: no
  // app, its chooser (the "android" package: you pick), or an app Android
  // hides from us. Then the agent's first look inside asks instead.
  fun linkHandler(url: String): String? = try {
    val view = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    pm.resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
      ?.takeIf { it != "android" }
  } catch (_: Exception) {
    null
  }

  // The default launcher; null while none is set (Android's chooser, the
  // "android" package, answers then, and it is never exempt).
  private fun homeScreen(): String? = try {
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    pm.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
      ?.takeIf { it != "android" }
  } catch (_: Exception) {
    null
  }
}
