package com.phonecando.runner

import android.content.Context
import android.media.MediaDrm
import android.os.Build
import android.os.PowerManager
import java.security.MessageDigest
import java.util.UUID

// Widevine device id for telemetry's drm_id. Off: the snapshot's drmIdHash
// stays null and MediaDrm is never touched. Turn on only together with the
// privacy page and docs/telemetry.md.
const val TELEMETRY_DRM_ID_ENABLED = false

// What JS reads (the module's getTelemetrySnapshot and
// consumeTelemetrySnapshot; the shape is src/telemetry.types.ts): the stored
// half from TelemetryStore plus the device state read live on every call
// (install source, battery optimisation, accessibility, the DRM id hash).
// `fgServiceRunning` comes from the caller: true while any agent's engine runs.
object TelemetrySnapshot {
  private const val DRM_PEPPER = "phonecando.drm.v1:"
  private val WIDEVINE_UUID: UUID = UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed")
  private const val HEX = "0123456789abcdef"

  @Volatile private var drmHash: String? = null

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
    "drmIdHash" to drmIdHash(),
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

  /** Lowercase SHA-256 hex of the pepper + hex(Widevine id); null while disabled. */
  private fun drmIdHash(): String? {
    if (!TELEMETRY_DRM_ID_ENABLED) return null
    drmHash?.let { return it }
    var drm: MediaDrm? = null
    val hash = try {
      drm = MediaDrm(WIDEVINE_UUID)
      // @NonNull; a platform that breaks that lands in the catch below.
      val id = drm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
      if (id.isEmpty()) null else sha256Hex(DRM_PEPPER + hex(id))
    } catch (_: Throwable) {
      null
    } finally {
      try {
        drm?.close()
      } catch (_: Throwable) {
      }
    }
    if (hash != null) drmHash = hash
    return hash
  }

  private fun hex(bytes: ByteArray): String {
    val out = StringBuilder(bytes.size * 2)
    for (b in bytes) {
      val v = b.toInt() and 0xff
      out.append(HEX[v ushr 4]).append(HEX[v and 0x0f])
    }
    return out.toString()
  }

  private fun sha256Hex(text: String): String =
    hex(MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)))
}
