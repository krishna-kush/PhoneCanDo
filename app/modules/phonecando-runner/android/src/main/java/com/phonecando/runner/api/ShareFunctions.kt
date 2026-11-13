package com.phonecando.runner.api

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.phonecando.runner.share.ShareChooser
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Sharing our link, for JS (engine/sharing.ts): the share sheet that says
// whether an app was picked (share/ShareChooser.kt), and when this install
// began, so a share link that opens the app counts as its way in only in
// its first days.
internal fun ModuleDefinitionBuilder.shareFunctions(context: () -> Context, activity: () -> Activity?) {
  // { chosen, app }: app is the picked app's label, or null.
  AsyncFunction("shareChooser") { text: String, title: String, promise: Promise ->
    val screen = activity()
    if (screen == null) {
      promise.resolve(mapOf("chosen" to false, "app" to null))
      return@AsyncFunction
    }
    ShareChooser.open(screen, text, title) { chosen, app ->
      promise.resolve(mapOf("chosen" to chosen, "app" to app))
    }
  }

  // Epoch ms of this app's first install on the phone: an update keeps it, a reinstall starts it over.
  Function("firstInstallTime") {
    val ctx = context()
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.packageManager.getPackageInfo(ctx.packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
      @Suppress("DEPRECATION")
      ctx.packageManager.getPackageInfo(ctx.packageName, 0)
    }
    info.firstInstallTime.toDouble()
  }
}
