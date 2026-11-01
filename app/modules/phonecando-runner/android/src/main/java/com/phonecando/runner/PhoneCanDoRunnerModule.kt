package com.phonecando.runner

import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class PhoneCanDoRunnerModule : Module() {
  private var serveProcess: Process? = null

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

  private fun opt(params: Map<String, Any>, key: String): String? {
    return (params[key] as? String)?.takeIf { it.isNotEmpty() }
  }

  private fun checkServeProcess(): Boolean {
    val proc = serveProcess ?: return false
    return try {
      proc.exitValue()
      serveProcess = null
      false
    } catch (_: IllegalThreadStateException) {
      true
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoRunner")
    Events("phonecandoLaunchTab", "phonecandoUnlockRequest", "phonecandoAccessibilityRequest")

    OnCreate {
      instance = this@PhoneCanDoRunnerModule
    }
    OnDestroy {
      if (instance === this@PhoneCanDoRunnerModule) instance = null
    }

    Function("getPrefix") {
      appFilesDir().absolutePath
    }

    Function("isServeRunning") {
      checkServeProcess()
    }

    Function("startServe") { params: Map<String, Any> ->
      if (checkServeProcess()) {
        return@Function "already-running"
      }
      val prefix = appFilesDir()
      val home = File(prefix, "phonecando-home").apply { mkdirs() }
      // v2 native binary: executed directly (bionic INTERP), no loader.
      // Ships in jniLibs, so it lives in the app's native library dir.
      val nativeLibDir = appContext.reactContext?.applicationInfo?.nativeLibraryDir
      val binary = File(
        opt(params, "binary")
          ?: (if (nativeLibDir != null) "$nativeLibDir/libopencode2.so" else "${prefix.absolutePath}/opencode-runtime/opencode2"),
      )
      if (!binary.exists()) {
        throw Exception("opencode binary missing: ${binary.absolutePath}")
      }
      if (!binary.canExecute()) binary.setExecutable(true)

      val port = opt(params, "port") ?: "4097"
      val libDir = opt(params, "libDir")
      val pb = ProcessBuilder(
        binary.absolutePath, "serve", "--port", port, "--hostname", "127.0.0.1"
      )
      pb.directory(home)
      pb.environment().apply {
        put("HOME", home.absolutePath)
        put("OPENCODE_DISABLE_AUTOUPDATE", "1")
        put("OPENCODE_DISABLE_LSP_DOWNLOAD", "1")
        put("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER", "true")
        if (libDir != null) put("OPENTUI_LIB_PATH", "$libDir/libopentui.so")
        put("TMPDIR", home.absolutePath)
        opt(params, "ldPreload")?.let { put("LD_PRELOAD", it) }
        opt(params, "ldLibraryPath")?.let { put("LD_LIBRARY_PATH", it) }
        opt(params, "sslCertFile")?.let { put("SSL_CERT_FILE", it) }
      }
      pb.redirectOutput(File(home, "serve.log"))
      pb.redirectErrorStream(true)
      serveProcess = pb.start()
      Log.i("PhoneCanDoRunner", "serve started")
      "started"
    }

    Function("stopServe") {
      serveProcess?.destroy()
      serveProcess = null
      "stopped"
    }

    Function("startServeService") { params: Map<String, Any> ->
      val context = appContext.reactContext ?: throw Exception("no react context")
      val intent = Intent(context, PhoneCanDoServeService::class.java).apply {
        action = PhoneCanDoServeService.ACTION_START
        opt(params, "binary")?.let { putExtra(PhoneCanDoServeService.EXTRA_BINARY, it) }
        opt(params, "port")?.let { putExtra(PhoneCanDoServeService.EXTRA_PORT, it) }
        opt(params, "libDir")?.let { putExtra(PhoneCanDoServeService.EXTRA_LIB_DIR, it) }
        opt(params, "sslCertFile")?.let { putExtra(PhoneCanDoServeService.EXTRA_SSL_CERT, it) }
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

    // Build flavor flag (PHONECANDO_AUTOMATION=play|full at prebuild time, baked in
    // as manifest meta-data by withAutomationFlag.js): "play" builds compile
    // the automation driver out. Absent meta-data (Expo Go / pre-flag
    // installs) means full — dev default.
    Function("isAutomationBuild") {
      try {
        val context = appContext.reactContext ?: return@Function "full"
        val ai = context.packageManager.getApplicationInfo(
          context.packageName,
          android.content.pm.PackageManager.GET_META_DATA,
        )
        ai.metaData?.getString("com.phonecando.automation") ?: "full"
      } catch (_: Exception) {
        "full"
      }
    }

    // Phone-control master switch. Default off, in-memory only (resets with
    // the app process). The Settings screen flips it after biometric auth;
    // the agent process has no way to flip it.
    Function("setAutomationEnabled") { enabled: Boolean ->
      AutomationGate.enabled = enabled
      enabled
    }

    Function("isAutomationEnabled") {
      AutomationGate.enabled
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
    // confirms (or cancels) the in-chat prompt. The app is the only caller.
    Function("resolveAccessibility") { ok: Boolean ->
      BridgeServer.resolveAccessibility(ok)
      ok
    }

    // True while the user has PhoneCanDo enabled in Android accessibility settings
    // (full builds only; play builds have no PCE host and stay false).
    Function("isUiAutomationConnected") {
      PceAuto.service != null
    }

    Function("openAccessibilitySettings") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.startActivity(
        Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      "opened"
    }

    Function("getServePort") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
        .getString(PhoneCanDoServeService.KEY_PORT, "") ?: ""
    }

    // v2 serve is auth-first: every REST/SSE call needs HTTP Basic with the
    // install-stable server password (generated once by the service, handed
    // to serve via env, stashed in prefs). JS reads it here and attaches the
    // header itself.
    Function("getServePassword") {
      val context = appContext.reactContext ?: throw Exception("no react context")
      context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
        .getString(PhoneCanDoServeService.KEY_PASSWORD, "") ?: ""
    }

    Function("health") { params: Map<String, Any> ->
      val port = opt(params, "port") ?: "4097"
      try {
        val context = appContext.reactContext ?: throw Exception("no react context")
        val pw = context.getSharedPreferences(PhoneCanDoServeService.PREFS, android.content.Context.MODE_PRIVATE)
          .getString(PhoneCanDoServeService.KEY_PASSWORD, null)?.takeIf { it.isNotEmpty() }
          ?: return@Function "starting"
        val conn = URL("http://127.0.0.1:$port/api/session").openConnection() as HttpURLConnection
        conn.connectTimeout = 5000
        conn.readTimeout = 5000
        val cred = android.util.Base64.encodeToString(
          "opencode:$pw".toByteArray(), android.util.Base64.NO_WRAP,
        )
        conn.setRequestProperty("Authorization", "Basic $cred")
        val code = conn.responseCode
        conn.disconnect()
        if (code == 200) "ok" else "http-$code"
      } catch (e: Exception) {
        "error:${e.message}"
      }
    }
  }
}
