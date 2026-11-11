package com.phonecando.runner

import android.content.Context
import android.content.Intent
import android.os.Build
import com.phonecando.runner.api.agentFunctions
import com.phonecando.runner.api.agentModelFunctions
import com.phonecando.runner.api.clipboardFunctions
import com.phonecando.runner.api.engineFunctions
import com.phonecando.runner.api.engineTerminalFunctions
import com.phonecando.runner.api.installFunctions
import com.phonecando.runner.api.kindFunctions
import com.phonecando.runner.api.memoryFunctions
import com.phonecando.runner.api.notifyFunctions
import com.phonecando.runner.api.runLimitFunctions
import com.phonecando.runner.api.userKindFunctions
import com.phonecando.runner.bridge.BridgePrompts
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.memory.MemoryStatus
import com.phonecando.runner.models.ModelJobsAnchor
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.prompts.OpenUrlPrompts
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class PhoneCanDoRunnerModule : Module() {
  companion object {
    private var instance: PhoneCanDoRunnerModule? = null

    // Native -> JS: where the app should land, {tab, agentId}
    // (notify/LaunchTargets: a notification tap, an agent's return, a
    // prompt). Prefs are the fallback when JS is not attached yet
    // (consumeLaunchTarget).
    fun emitLaunchTarget(target: Map<String, Any?>) {
      instance?.sendEvent("phonecandoLaunchTarget", target)
    }

    // Bridge -> JS: a prompt for the user from an agent (BridgePrompts
    // shape: requestId, kind, agentId, agentName, reason; an open_url
    // prompt, prompts/OpenUrlPrompts, adds url). pendingPrompts covers the
    // moments JS was not attached.
    fun emitBridgePrompt(prompt: Map<String, Any?>) {
      instance?.sendEvent("phonecandoBridgePrompt", prompt)
    }
  }

  // Every engine change, as the phonecandoEngineState event (EngineStatus.toMap),
  // a model server's prompt reading as phonecandoPromptReading
  // ({reading}: PromptReading.toMap, null once nothing is read) and the
  // memory guard's reading as phonecandoMemory (MemoryStatus.toMap).
  private val engineListener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      sendEvent("phonecandoEngineState", status.toMap())
    }

    override fun onPrompt(reading: PromptReading?) {
      sendEvent("phonecandoPromptReading", mapOf("reading" to reading?.toMap()))
    }

    override fun onMemory(status: MemoryStatus) {
      sendEvent("phonecandoMemory", status.toMap())
    }
  }

  private fun context(): Context = appContext.reactContext ?: throw Exception("no react context")

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

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoRunner")
    Events("phonecandoLaunchTarget", "phonecandoBridgePrompt", "phonecandoEngineState", "phonecandoPromptReading", "phonecandoMemory")

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
      Engines.addListener(engineListener)
      // Model downloads and imports keep the process in the foreground.
      appContext.reactContext?.let { ModelJobsAnchor.install(it) }
    }
    OnDestroy {
      Engines.removeListener(engineListener)
      if (instance === this@PhoneCanDoRunnerModule) instance = null
    }

    agentFunctions { context() }
    agentModelFunctions { context() }
    engineFunctions { context() }
    engineTerminalFunctions { context() }
    installFunctions { context() }
    kindFunctions { context() }
    userKindFunctions { context() }
    notifyFunctions { context() }
    clipboardFunctions { context() }
    runLimitFunctions { context() }
    memoryFunctions { context() }

    Function("getPrefix") {
      appFilesDir().absolutePath
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
    // engine launcher passes it to every engine as PHONECANDO_CHANNEL. Only full
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

    // Prompts for the user from agents: the ones a bridge request waits on
    // (biometric unlock, accessibility setup), one per asking request, then
    // the links agents asked the phone to open (open_url, nothing waits on
    // those). The app is the only caller; no agent process can reach these.
    // resolveAccessibility's `guided`: the screen the user opened is a
    // restricted-settings guide step. The bridge keeps waiting for the
    // service either way; `guided` only makes its answer say
    // `restricted: sideload`.
    Function("pendingPrompts") {
      BridgePrompts.pending() + OpenUrlPrompts.pending()
    }

    Function("resolveUnlock") { requestId: String, ok: Boolean ->
      BridgePrompts.resolveUnlock(requestId, ok)
      ok
    }

    Function("resolveAccessibility") { requestId: String, ok: Boolean, guided: Boolean ->
      BridgePrompts.resolveAccessibility(requestId, ok, guided)
      ok
    }

    // Ends one open_url prompt: action open (the app opened it), copy (the
    // link goes on the clipboard) or dismiss. False when it is gone or the
    // copy failed.
    Function("resolveOpenUrl") { requestId: String, action: String ->
      OpenUrlPrompts.resolve(context(), requestId, action)
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
    // list (TelemetrySnapshot). fgServiceRunning is true while any agent's
    // engine runs; the other state fields are read live.
    Function("getTelemetrySnapshot") {
      val context = telemetryContext() ?: return@Function null
      TelemetrySnapshot.peek(context, Engines.peek()?.anyLive() == true)
    }

    Function("consumeTelemetrySnapshot") {
      val context = telemetryContext() ?: return@Function null
      TelemetrySnapshot.consume(context, Engines.peek()?.anyLive() == true)
    }

    // Mirrors the user's telemetry on/off choice into the telemetry prefs
    // (default on). While off, no engine event stream is opened to count
    // sessions; counters and crash capture stay local either way. Synchronous.
    Function("setTelemetryEnabled") { enabled: Boolean ->
      telemetryContext()
      TelemetrySwitch.setEnabled(enabled)
    }
  }
}
