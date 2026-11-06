package com.phonecando.runner

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.phonecando.runner.agents.AgentKinds
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class PhoneCanDoRunnerModule : Module() {
  companion object {
    private var instance: PhoneCanDoRunnerModule? = null

    // Bridge -> JS: switch tabs when the agent returns to PhoneCanDo or asks for
    // unlock. Prefs are the fallback when JS is not attached yet.
    fun emitLaunchTab(tab: String) {
      instance?.sendEvent("phonecandoLaunchTab", mapOf("tab" to tab))
    }

    fun emitUnlockRequest(reason: String) {
      instance?.sendEvent("phonecandoUnlockRequest", mapOf("reason" to reason))
    }

    fun emitAccessibilityRequest(reason: String) {
      instance?.sendEvent("phonecandoAccessibilityRequest", mapOf("reason" to reason))
    }
  }

  private fun appFilesDir(): File {
    val reactContext = appContext.reactContext ?: throw Exception("no react context")
    reactContext.filesDir?.let { return it }
    return reactContext.applicationContext.filesDir
  }

  private fun telemetryContext(): android.content.Context? {
    val context = appContext.reactContext ?: return null
    TelemetryRecorder.install(context)
    return context
  }

  private fun opt(params: Map<String, Any>, key: String): String? {
    return (params[key] as? String)?.takeIf { it.isNotEmpty() }
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoRunner")
    Events("phonecandoLaunchTab", "phonecandoUnlockRequest", "phonecandoAccessibilityRequest")

    OnCreate {
      instance = this@PhoneCanDoRunnerModule
      // App start clears the "PhoneCanDo updated" notice. Every way back
      // after a self-update (the installer's Open, the launcher, the notice)
      // cold-starts the new build, and this hook runs once per start, before
      // any screen and without depending on UI code; a per-resume hook would
      // repeat it for nothing.
      appContext.reactContext?.let { PackageReplacedReceiver.clearNotice(it) }
      // Telemetry is installed by TelemetryInitProvider before
      // Application.onCreate; this idempotent repeat covers a merged
      // manifest that lacks the provider.
      appContext.reactContext?.let { TelemetryRecorder.install(it) }
    }
    OnDestroy {
      if (instance === this@PhoneCanDoRunnerModule) instance = null
    }

    Function("getPrefix") {
      appFilesDir().absolutePath
    }

    // The engine the foreground service runs. The updater stops the engine
    // before a self-update and polls this until serve has exited.
    Function("isServeRunning") {
      PhoneCanDoServeService.isServeAlive()
    }

    Function("startServeService") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("no react context")
      val intent = Intent(context, PhoneCanDoServeService::class.java).apply {
        action = PhoneCanDoServeService.ACTION_START
        // Boot time (telemetry) runs from this request, not from the
        // service's own start.
        putExtra(PhoneCanDoServeService.EXTRA_REQUESTED_AT, SystemClock.elapsedRealtime())
        opt(params, "port")?.let { putExtra(PhoneCanDoServeService.EXTRA_PORT, it) }
      }
      if (Build.VERSION.SDK_INT >= 26) {
        context.startForegroundService(intent)
      } else {
        @Suppress("DEPRECATION")
        context.startService(intent)
      }
      "service-started"
    }

    Function("stopServeService") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.stopService(Intent(context, PhoneCanDoServeService::class.java))
      "service-stopped"
    }

    Function("setActiveSession") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("no react context")
      val intent = Intent(context, PhoneCanDoServeService::class.java).apply {
        action = PhoneCanDoServeService.ACTION_SESSION
        opt(params, "sessionId")?.let { putExtra(PhoneCanDoServeService.EXTRA_SESSION_ID, it) }
        opt(params, "title")?.let { putExtra(PhoneCanDoServeService.EXTRA_TITLE, it) }
      }
      if (Build.VERSION.SDK_INT >= 26) {
        context.startForegroundService(intent)
      } else {
        @Suppress("DEPRECATION")
        context.startService(intent)
      }
      "session-updated"
    }

    Function("leaveSession") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("no react context")
      val intent = Intent(context, PhoneCanDoServeService::class.java).apply {
        action = PhoneCanDoServeService.ACTION_LEAVE
        opt(params, "sessionId")?.let { putExtra(PhoneCanDoServeService.EXTRA_SESSION_ID, it) }
      }
      if (Build.VERSION.SDK_INT >= 26) {
        context.startForegroundService(intent)
      } else {
        @Suppress("DEPRECATION")
        context.startService(intent)
      }
      "leave-reported"
    }

    Function("updateSessionTitle") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("no react context")
      val intent = Intent(context, PhoneCanDoServeService::class.java).apply {
        action = PhoneCanDoServeService.ACTION_TITLE
        opt(params, "sessionId")?.let { putExtra(PhoneCanDoServeService.EXTRA_SESSION_ID, it) }
        opt(params, "title")?.let { putExtra(PhoneCanDoServeService.EXTRA_TITLE, it) }
      }
      if (Build.VERSION.SDK_INT >= 26) {
        context.startForegroundService(intent)
      } else {
        @Suppress("DEPRECATION")
        context.startService(intent)
      }
      "title-updated"
    }

    // System notification permission (Android 13+). Plain posts are silently
    // dropped while the grant is missing — the app never asked, so appops
    // sat at `ignore` and even the diagnostic post vanished. Asks once
    // (flag in the shared engine prefs); afterwards the user flips it in
    // Settings. Fire-and-forget: no result callback needed for our use.
    Function("requestNotificationPermission") {
      if (Build.VERSION.SDK_INT < 33) return@Function "unsupported"
      val context = appContext.reactContext ?: throw Exception("no react context")
      val prefs = context.getSharedPreferences(
        PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE,
      )
      if (prefs.getBoolean("notif_perm_asked", false)) return@Function "already-asked"
      val activity = appContext.activityProvider?.currentActivity
        ?: return@Function "no-activity"
      androidx.core.app.ActivityCompat.requestPermissions(
        activity,
        arrayOf("android.permission.POST_NOTIFICATIONS"),
        4201,
      )
      prefs.edit().putBoolean("notif_perm_asked", true).apply()
      "requested"
    }

    // Build channel: the Gradle flavor (full|lite|play) writes it into the
    // manifest meta-data com.phonecando.channel (withBuildChannel.js), and the
    // serve service passes it to the engine as PHONECANDO_CHANNEL. Only full
    // compiles the accessibility driver and PCE. Absent meta-data (Expo Go /
    // pre-channel installs) means full — dev default.
    Function("getBuildChannel") {
      try {
        val context = appContext.reactContext ?: return@Function "full"
        val ai = context.packageManager.getApplicationInfo(
          context.packageName,
          android.content.pm.PackageManager.GET_META_DATA,
        )
        ai.metaData?.getString("com.phonecando.channel")
          ?: ai.metaData?.getString("com.phonecando.automation")
          ?: "full"
      } catch (_: Exception) {
        "full"
      }
    }

    // Phone-control master switch. Default off, in-memory only (resets with
    // the app process). The Settings screen flips it after biometric auth;
    // the agent process has no way to flip it.
    Function("setAutomationEnabled") { enabled: Boolean ->
      AutomationHosts.install()
      AutomationHosts.current?.setEnabled(enabled)
      AutomationHosts.current?.enabled == true
    }

    Function("isAutomationEnabled") {
      AutomationHosts.install()
      AutomationHosts.current?.enabled == true
    }

    // One-shot tab requested by the bridge's /app route. Read-and-clear so a
    // stale request cannot yank the user to Settings on a later resume.
    Function("consumeLaunchTab") {
      val context = appContext.reactContext ?: return@Function ""
      val prefs = context.getSharedPreferences(
        PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE,
      )
      val tab = prefs.getString(PhoneCanDoServeService.KEY_PENDING_TAB, "") ?: ""
      if (tab.isNotEmpty()) {
        prefs.edit().remove(PhoneCanDoServeService.KEY_PENDING_TAB).apply()
      }
      tab
    }

    // One-shot biometric request from the bridge. The modal reads-and-clears
    // it on mount/resume; the event covers the already-foreground case.
    Function("consumeUnlockRequest") {
      val context = appContext.reactContext ?: return@Function ""
      val prefs = context.getSharedPreferences(
        PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE,
      )
      val reason = prefs.getString(PhoneCanDoServeService.KEY_PENDING_UNLOCK, "") ?: ""
      if (reason.isNotEmpty()) {
        prefs.edit().remove(PhoneCanDoServeService.KEY_PENDING_UNLOCK).apply()
      }
      reason
    }

    // Resolve the bridge's waiting /unlock request after the user's biometric
    // prompt. The app is the only caller; the agent process cannot reach this.
    Function("resolveUnlock") { ok: Boolean ->
      BridgeServer.resolveUnlock(ok)
      ok
    }

    Function("consumeAccessibilityRequest") {
      val context = appContext.reactContext ?: return@Function ""
      val prefs = context.getSharedPreferences(
        PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE,
      )
      val reason = prefs.getString(PhoneCanDoServeService.KEY_PENDING_ACCESSIBILITY, "") ?: ""
      if (reason.isNotEmpty()) {
        prefs.edit().remove(PhoneCanDoServeService.KEY_PENDING_ACCESSIBILITY).apply()
      }
      reason
    }

    // Resolve the bridge's waiting /accessibility request after the user
    // confirms (or cancels) the in-chat prompt. `guided`: the app is running
    // its restricted-settings guide, so the bridge answers at once instead of
    // waiting for a service that cannot connect yet. The app is the only caller.
    Function("resolveAccessibility") { ok: Boolean, guided: Boolean ->
      BridgeServer.resolveAccessibility(ok, guided)
      ok
    }

    // True while the user has PhoneCanDo enabled in Android accessibility settings
    // (full builds only; play builds have no PCE host and stay false).
    Function("isUiAutomationConnected") {
      AutomationHosts.install()
      AutomationHosts.current?.connected == true
    }

    // True when PhoneCanDo is listed in Android's enabled accessibility
    // services (set by the switch, before the service binds). Lite/play
    // builds have no service and stay false.
    Function("isAccessibilityServiceEnabled") {
      val context = appContext.reactContext ?: return@Function false
      RestrictedSettings.isServiceEnabled(context)
    }

    // The service ran on this install, which proves the lock was cleared.
    Function("hasAccessibilityConnectedBefore") {
      val context = appContext.reactContext ?: return@Function false
      RestrictedSettings.everConnected(context)
    }

    // Whether Android lets PhoneCanDo install APKs ("Install unknown apps"
    // for this app). The updater checks it before the installer screen, so
    // the app explains the switch itself instead of Android's prompt landing
    // on top of the app's own.
    Function("canRequestPackageInstalls") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function true
      try {
        context.packageManager.canRequestPackageInstalls()
      } catch (_: Throwable) {
        true
      }
    }

    // updates.ts calls this right before it hands the APK to Android's
    // installer, so PackageReplacedReceiver in the new build knows the update
    // is PhoneCanDo's own; Play, adb and dev reinstalls leave no mark.
    Function("markSelfUpdatePending") {
      val context = appContext.reactContext ?: return@Function false
      PackageReplacedReceiver.markPending(context)
    }

    // Android 14+: PhoneCanDo can show Android's "Restricted setting" note
    // itself (RestrictedSettings.kt). False on Android 13 or when the OEM
    // guards that activity; the guide then sends the user to the switch.
    Function("canShowRestrictedSettingNote") {
      val context = appContext.reactContext ?: return@Function false
      RestrictedSettings.canShowNote(context)
    }

    // Shows Android's "Restricted setting" note over the app. "opened" | "failed".
    Function("showRestrictedSettingNote") {
      val context = appContext.reactContext ?: return@Function "failed"
      RestrictedSettings.showNote(context)
    }

    // Opens this app's App info page (the ⋮ menu there holds "Allow
    // restricted settings" once Android has shown its note).
    Function("openAppInfoSettings") {
      val context = appContext.reactContext ?: return@Function "failed"
      try {
        context.startActivity(
          Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(android.net.Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        "opened"
      } catch (_: Throwable) {
        "failed"
      }
    }

    // Opens the Accessibility list scrolled to and highlighting our service
    // (the Settings app honours these fragment-args extras on AOSP-based
    // builds; others ignore them and show the plain list).
    Function("openAccessibilitySettings") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      val component = android.content.ComponentName(
        context.packageName, RestrictedSettings.SERVICE_CLASS,
      ).flattenToString()
      val args = android.os.Bundle().apply { putString(":settings:fragment_args_key", component) }
      context.startActivity(
        Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .putExtra(":settings:fragment_args_key", component)
          .putExtra(":settings:show_fragment_args", args)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      "opened"
    }

    // Telemetry (src/telemetry.types.ts, TelemetryNativeSnapshot). Both are
    // synchronous and record nothing. getTelemetrySnapshot peeks;
    // consumeTelemetrySnapshot returns the same shape and, under the
    // telemetry store's one lock, zeroes the counters, clears lastExitCode,
    // lastDiedAt and lastBootMs (lastStderrTail stays) and drains the crash
    // list (TelemetrySnapshot). fgServiceRunning is the serve-running check
    // (isServeRunning); the other state fields are read live.
    Function("getTelemetrySnapshot") {
      val context = telemetryContext() ?: return@Function null
      TelemetrySnapshot.peek(context, PhoneCanDoServeService.isServeAlive())
    }

    Function("consumeTelemetrySnapshot") {
      val context = telemetryContext() ?: return@Function null
      TelemetrySnapshot.consume(context, PhoneCanDoServeService.isServeAlive())
    }

    // Mirrors the user's telemetry on/off choice into the telemetry prefs
    // (default on). While off, the serve service opens the engine event
    // stream only for watched chats, not to count sessions; counters and
    // crash capture stay local either way. Synchronous.
    Function("setTelemetryEnabled") { enabled: Boolean ->
      telemetryContext()
      TelemetrySwitch.setEnabled(enabled)
    }

    Function("getServePort") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
        .getString(PhoneCanDoServeService.KEY_PORT, "") ?: ""
    }


    // The engine is auth-first: every REST/SSE call needs the install-stable
    // server password (generated once by the service, handed to the engine
    // via env, stashed in prefs). JS reads it here; the agent kind decides
    // how it rides on a request.
    Function("getServePassword") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
        .getString(PhoneCanDoServeService.KEY_PASSWORD, "") ?: ""
    }

    Function("health") { params: Map<String, Any> ->
      val port = opt(params, "port") ?: PhoneCanDoServeService.DEFAULT_PORT
      try {
        val context = appContext.reactContext ?: throw Exception("no react context")
        val pw = context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
          .getString(PhoneCanDoServeService.KEY_PASSWORD, null)?.takeIf { it.isNotEmpty() }
          ?: return@Function "starting"
        val code = AgentKinds.default.healthProbe(port, pw).status(5000, 5000)
        if (code == 200) "ok" else "http-$code"
      } catch (e: Exception) {
        "error:${e.message}"
      }
    }
  }
}
