package com.phonecando.runner.update

import android.content.Context

// The build installed now, PackageInfo's longVersionCode (minSdk 29 has
// it), for the cleanup after an install (CleanRules.afterInstall). Null
// when Android won't say: then nothing is cleaned.
internal object InstalledVersion {
  fun of(context: Context): Long? = try {
    @Suppress("DEPRECATION")
    context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
  } catch (_: Exception) {
    null
  }
}
