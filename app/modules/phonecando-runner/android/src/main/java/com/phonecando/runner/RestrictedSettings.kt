package com.phonecando.runner

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings

// Android 13+ "restricted settings": the Accessibility switch is refused for
// an app installed from a file until the user picks App info → ⋮ → Allow
// restricted settings, and that menu item appears only after Android has
// shown its "Restricted setting" note for the app. The app cannot read this
// state (research/restricted-settings.md: the app op is restrict-read on
// 13–16 and the Android 15+ API needs a signature permission), so the setup
// guide is a build-time choice (RESTRICTED_FLOW in useAccessibilitySteps.ts)
// with three steps: show the note, allow in App info, turn the switch on.
//
// Android 14+ exports the Settings activity behind the note
// (android.settings.SHOW_RESTRICTED_SETTING_DIALOG) without a permission;
// 13 keeps it private. Started for our own package it shows the note in
// place and moves the state to "acknowledged", which is what adds the App
// info item, so the user never has to find PhoneCanDo in the Accessibility
// list. It sets that state unconditionally, so on an app that was not locked
// (or was already allowed) it locks it; step 2 of the guide always follows
// and allows it, so the worst case is one extra confirmation. Verified on a
// Moto G96, Android 16, 2026-11-04: `default` → `ignore`.
object RestrictedSettings {
  const val SIDELOAD = "sideload"
  const val NONE = "none"

  const val SERVICE_CLASS = "com.phonecando.runner.uiauto.PhoneCanDoAccessibilityService"
  private const val ACTION_SHOW_NOTE = "android.settings.SHOW_RESTRICTED_SETTING_DIALOG"
  private const val KEY_EVER_CONNECTED = "a11y_ever_connected"
  private const val KEY_CONNECTED_AT = "a11y_connected_at"

  // Best guess for the bridge's `restricted` field when the app gives no
  // answer: "sideload" when the current install came from a file (the only
  // kind Android locks) and nothing says the switch was allowed since.
  fun state(context: Context): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return NONE
    if (isServiceEnabled(context) || everConnected(context)) return NONE
    return if (fileSourced(context)) SIDELOAD else NONE
  }

  // True when PhoneCanDo is in Android's enabled accessibility services
  // (Secure settings, readable by any app, written the moment the switch
  // turns on, before the service binds).
  fun isServiceEnabled(context: Context): Boolean {
    val ours = ComponentName(context.packageName, SERVICE_CLASS)
    val enabled = try {
      Settings.Secure.getString(
        context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
    } catch (_: Throwable) {
      null
    } ?: return false
    return enabled.split(':').any { ComponentName.unflattenFromString(it) == ours }
  }

  // The accessibility service calls this when Android binds it. Shared prefs
  // survive updates and go with an uninstall, which is the lock's lifetime
  // too (Android 14+ sets it only on a first install for the user).
  fun markConnected(context: Context) {
    prefs(context).edit()
      .putBoolean(KEY_EVER_CONNECTED, true)
      .putLong(KEY_CONNECTED_AT, System.currentTimeMillis())
      .apply()
  }

  // The service ran on this install, so the switch was allowed once. Android
  // 13 locks again on every install from a file, updates included, so there
  // a file update after that run voids the memory.
  fun everConnected(context: Context): Boolean {
    val p = prefs(context)
    if (!p.getBoolean(KEY_EVER_CONNECTED, false)) return false
    if (Build.VERSION.SDK_INT != Build.VERSION_CODES.TIRAMISU) return true
    val connectedAt = p.getLong(KEY_CONNECTED_AT, 0L)
    if (connectedAt <= 0L || !fileSourced(context)) return true
    val updatedAt = try {
      context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
    } catch (_: Throwable) {
      return true
    }
    return updatedAt <= connectedAt
  }

  // Android 14+ and the OEM kept the note's activity exported and unguarded.
  fun canShowNote(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return false
    val info = try {
      context.packageManager.resolveActivity(
        noteIntent(context),
        PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
      )
    } catch (_: Throwable) {
      null
    } ?: return false
    val activity = info.activityInfo ?: return false
    return activity.exported && activity.permission == null
  }

  // Shows Android's "Restricted setting" note for this app, over the app.
  // "opened" | "failed".
  fun showNote(context: Context): String {
    if (!canShowNote(context)) return "failed"
    return try {
      context.startActivity(noteIntent(context).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      "opened"
    } catch (_: Throwable) {
      "failed"
    }
  }

  private fun noteIntent(context: Context): Intent =
    Intent(ACTION_SHOW_NOTE)
      .putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
      .putExtra(Intent.EXTRA_UID, context.applicationInfo.uid)

  // Installer-declared package source of the current install. A failed
  // lookup counts as not from a file.
  private fun fileSourced(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false
    return try {
      val source = context.packageManager.getInstallSourceInfo(context.packageName).packageSource
      source == PackageInstaller.PACKAGE_SOURCE_LOCAL_FILE ||
        source == PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE
    } catch (_: Throwable) {
      false
    }
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
}
