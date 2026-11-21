package com.phonecando.runner

import android.content.Context
import android.os.Build
import android.os.PowerManager

// What JS reads (the module's getTelemetrySnapshot and
// consumeTelemetrySnapshot; the shape is src/telemetry.types.ts): the stored
// half from TelemetryStore plus the device state read live on every call
// (install source, battery optimisation, accessibility).
// `fgServiceRunning` comes from the caller: true while any agent's engine runs.
object TelemetrySnapshot {
  /** Read-only peek. */
  fun peek(context: Context, fgServiceRunning: Boolean): Map<String, Any?> =
    toMap(context, fgServiceRunning, TelemetryStore.read(TelemetryStore.prefs(), consume = false))

  // Same shape; under the store's one lock it also zeroes every counter,
  // clears lastExitCode, lastDiedAt and lastBootMs and drains the crash list,
  // so each is reported once. lastStderrTail stays (TelemetryStore.drain).
  fun consume(context: Context, fgServiceRunning: Boolean): Map<String, Any?> =
    toMap(context, fgServiceRunning, TelemetryStore.read(TelemetryStore.prefs(), consume = true))

  private fun toMap(context: Context, fgServiceRunning: Boolean, s: TelemetryStore.Stored): Map<String, Any?> = mapOf(
    "installSource" to installSource(context),
    "batteryOptIgnored" to batteryOptIgnored(context),
    "fgServiceRunning" to fgServiceRunning,
    "a11yConnected" to a11yConnected(),
    "lowMemoryTrims" to s.lowMemoryTrims,
    "engine" to mapOf(
      "starts" to s.starts,
      "startFails" to s.startFails,
      "died" to s.died,
      "lastExitCode" to s.lastExitCode,
      "lastDiedAt" to s.lastDiedAt?.toDouble(),
      "lastStderrTail" to s.lastStderrTail,
      "portSquats" to s.portSquats,
      "lastBootMs" to s.lastBootMs?.toDouble(),
    ),
    "toolCalls" to s.toolCalls,
    "sessionCreates" to s.sessionCreates,
    "nativeCrashes" to s.crashes,
  )

  // Installer of the current install, e.g. com.google.android.packageinstaller
  // for a file install or the app itself after a self-update.
  private fun installSource(context: Context): String? = try {
    val pm = context.packageManager
    val name = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      pm.getInstallSourceInfo(context.packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      pm.getInstallerPackageName(context.packageName)
    }
    name?.takeIf { it.isNotEmpty() }
  } catch (_: Throwable) {
    null
  }

  private fun batteryOptIgnored(context: Context): Boolean = try {
    context.getSystemService(PowerManager::class.java)
      ?.isIgnoringBatteryOptimizations(context.packageName) == true
  } catch (_: Throwable) {
    false
  }

  // Same check as the module's isUiAutomationConnected: lite/play have no
  // FullAutomation class, so the host stays null and this is false.
  private fun a11yConnected(): Boolean = try {
    AutomationHosts.install()
    AutomationHosts.current?.connected == true
  } catch (_: Throwable) {
    false
  }
}
