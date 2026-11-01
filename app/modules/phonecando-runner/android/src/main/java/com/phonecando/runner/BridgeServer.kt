package com.phonecando.runner

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Process
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.CompletableFuture

// Loopback bridge for the agent's mobile_* tools: opencode serve is a separate
// process, so a local socket is the only shared channel. NanoHTTPD is bound to
// 127.0.0.1 only (nothing on the network/LAN can reach it) and every request
// needs the bearer token handed to serve via env. Envelope:
// {"ok":true,"data":...} / {"ok":false,"code":...,"message":...}.
class BridgeServer private constructor(
  private val context: Context,
  val token: String,
  port: Int,
  private val onCall: () -> Unit = {},
) : NanoHTTPD("127.0.0.1", port) {

  var url = ""
    private set

  override fun serve(session: IHTTPSession): Response {
    val auth = session.headers["authorization"] ?: ""
    val provided = auth.removePrefix("Bearer ").takeIf { auth.startsWith("Bearer ") } ?: ""
    if (!MessageDigest.isEqual(token.toByteArray(), provided.toByteArray())) {
      return json(Response.Status.UNAUTHORIZED, errorJson("unauthorized", "bad bearer token"))
    }
    onCall()
    val method = session.method.name
    if (method == "POST") {
      val declared = session.headers["content-length"]?.toLongOrNull() ?: 0L
      if (declared > MAX_BODY) {
        return json(Response.Status.lookup(413) ?: Response.Status.BAD_REQUEST, errorJson("too_large", "body over $MAX_BODY bytes"))
      }
    }
    val body = if (method == "POST") {
      try {
        val files = HashMap<String, String>()
        session.parseBody(files)
        files["postData"] ?: "{}"
      } catch (e: Exception) {
        return json(Response.Status.BAD_REQUEST, errorJson("bad_json", e.message ?: "cannot read body"))
      }
    } else {
      "{}"
    }
    val (status, payload) = try {
      route(method, session.uri, body)
    } catch (e: Exception) {
      Log.w(TAG, "$method ${session.uri} failed", e)
      Response.Status.INTERNAL_ERROR to errorJson("internal", e.message ?: "bridge failure")
    }
    return json(status, payload)
  }

  private fun route(method: String, path: String, body: String): Pair<Response.Status, String> {
    if (method == "GET" && path == "/ping") return Response.Status.OK to okJson(ping())
    if (method == "GET" && path == "/battery") return Response.Status.OK to okJson(battery())

    // Master switch (full builds): every side-effecting call needs the user's
    // unlock. The switch is in-memory in the app process (biometric-gated), so
    // a stale "on" cannot survive a restart. Play builds have no driver and no
    // switch; their six basic tools stay available (Slice-1 behavior).
    if (path == "/notify" || path == "/share" || path == "/open" ||
      path == "/clipboard" || path.startsWith("/pce/")
    ) {
      if (flavor() != "play" && !AutomationGate.enabled) {
        return Response.Status.FORBIDDEN to errorJson(
          "automation_off", "phone control is locked; unlock it in PhoneCanDo settings",
        )
      }
      if (path.startsWith("/pce/") && PceAuto.service == null) {
        return Response.Status.SERVICE_UNAVAILABLE to errorJson(
          "automation_unavailable", "enable PhoneCanDo in Android accessibility settings",
        )
      }
    }

    if (path.startsWith("/pce/")) {
      val pce = PceAuto.service
        ?: return Response.Status.SERVICE_UNAVAILABLE to errorJson(
          "automation_unavailable", "enable PhoneCanDo in Android accessibility settings",
        )
      if (method == "GET" && path == "/pce/describe") {
        return uiResult(pce.describe())
      }
      if (method != "POST") {
        return Response.Status.NOT_FOUND to errorJson("not_found", "no route $method $path")
      }
      val o = try {
        JSONObject(body.ifBlank { "{}" })
      } catch (_: Exception) {
        return Response.Status.BAD_REQUEST to errorJson("bad_json", "body must be a JSON object")
      }
      val result = when (path) {
        "/pce/observe" -> pce.observe(o)
        "/pce/act" -> pce.act(o)
        "/pce/pack" -> pce.pack(o)
        else -> return Response.Status.NOT_FOUND to errorJson("not_found", "no route $method $path")
      }
      return uiResult(result)
    }

    val isPost = method == "POST" &&
      (path == "/notify" || path == "/share" || path == "/open" ||
        path == "/clipboard" || path == "/app" || path == "/unlock" ||
        path == "/accessibility")
    if (isPost) {
      val o = try {
        JSONObject(body.ifBlank { "{}" })
      } catch (_: Exception) {
        return Response.Status.BAD_REQUEST to errorJson("bad_json", "body must be a JSON object")
      }
      return when (path) {
        "/notify" -> notify(o)
        "/share" -> share(o)
        "/open" -> open(o)
        "/app" -> app(o)
        "/unlock" -> unlock(o)
        "/accessibility" -> accessibility(o)
        else -> clipboard(o)
      }
    }
    return Response.Status.NOT_FOUND to errorJson("not_found", "no route $method $path")
  }

  // The PCE adapter returns {ok:true,...} / {ok:false,code,message};
  // unwrap it into the bridge envelope.
  private fun uiResult(result: JSONObject): Pair<Response.Status, String> {
    if (!result.optBoolean("ok", true)) {
      val error = JSONObject()
        .put("ok", false)
        .put("code", result.optString("code", "ui_error"))
        .put("message", result.optString("message", result.optString("error", "ui action failed")))
      result.optJSONObject("recover")?.let { error.put("recover", it) }
      result.optJSONArray("candidates")?.let { error.put("candidates", it) }
      return Response.Status.OK to error.toString()
    }
    result.remove("ok")
    return Response.Status.OK to okJson(result)
  }

  private fun ping(): JSONObject = JSONObject()
    .put("flavor", flavor())
    .put("sdk", Build.VERSION.SDK_INT)
    .put("model", Build.MODEL)
    .put("automation", flavor() != "play")
    .put("unlocked", AutomationGate.enabled)
    // `ui` is kept as the compatibility alias used by the existing prompt.
    .put("ui", PceAuto.service != null)
    .put("pce", PceAuto.service != null)

  private fun battery(): JSONObject {
    val bm = context.getSystemService(BatteryManager::class.java)
    val sticky = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = sticky?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = (sticky?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100).coerceAtLeast(1)
    val status = sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val percent = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
      ?: ((level * 100) / scale)
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
      status == BatteryManager.BATTERY_STATUS_FULL
    return JSONObject().put("percent", percent).put("charging", charging)
  }

  private fun notify(o: JSONObject): Pair<Response.Status, String> {
    val text = o.optString("text", "").takeIf { it.isNotBlank() }
      ?: return Response.Status.BAD_REQUEST to errorJson("bad_request", "text is required")
    val title = o.optString("title", "").takeIf { it.isNotBlank() } ?: "PhoneCanDo"
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(AGENT_CHANNEL, "PhoneCanDo agent", NotificationManager.IMPORTANCE_DEFAULT)
    )
    val n = Notification.Builder(context, AGENT_CHANNEL)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setAutoCancel(true)
      .build()
    nm.notify(NOTIF_BASE + (title.hashCode() and 0xfff), n)
    // Advisory, not an error: a missing POST_NOTIFICATIONS grant posts nothing.
    val shown = runCatching { nm.areNotificationsEnabled() }.getOrDefault(false)
    return Response.Status.OK to okJson(JSONObject().put("posted", shown))
  }

  // Both intents start activities: Android blocks background activity starts,
  // so these work while the app is foreground (the normal agent flow) and are
  // silently dropped if the user backgrounded it mid-run.
  private fun share(o: JSONObject): Pair<Response.Status, String> {
    val text = o.optString("text", "").takeIf { it.isNotBlank() }
      ?: return Response.Status.BAD_REQUEST to errorJson("bad_request", "text is required")
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    o.optString("title", "").takeIf { it.isNotBlank() }?.let { send.putExtra(Intent.EXTRA_SUBJECT, it) }
    val chooser = Intent.createChooser(send, "Share")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(chooser)
      Response.Status.OK to okJson(JSONObject().put("started", true))
    } catch (e: Exception) {
      Response.Status.OK to errorJson("no_activity", e.message ?: "no app to share to")
    }
  }

  private fun open(o: JSONObject): Pair<Response.Status, String> {
    val raw = o.optString("url", "").takeIf { it.isNotBlank() }
      ?: return Response.Status.BAD_REQUEST to errorJson("bad_request", "url is required")
    val uri = try {
      Uri.parse(raw)
    } catch (_: Exception) {
      return Response.Status.BAD_REQUEST to errorJson("bad_url", "cannot parse url")
    }
    val scheme = uri.scheme?.lowercase()
      ?: return Response.Status.BAD_REQUEST to errorJson("bad_url", "url needs a scheme")
    if (scheme !in ALLOWED_SCHEMES) {
      return Response.Status.BAD_REQUEST to errorJson("bad_scheme", "allowed: ${ALLOWED_SCHEMES.joinToString(",")}")
    }
    val view = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(view)
      Response.Status.OK to okJson(JSONObject().put("started", true))
    } catch (e: Exception) {
      Response.Status.OK to errorJson("no_activity", e.message ?: "nothing handles $scheme")
    }
  }

  // Own-app launch is intentionally outside the phone-control gate: returning
  // to PhoneCanDo and asking the user to unlock are safe. `tab` is handed to JS via
  // prefs + a native event; the notification is the fallback when Android
  // blocks a background activity start.
  private fun app(o: JSONObject): Pair<Response.Status, String> {
    val tab = o.optString("tab", "home").takeIf { it in APP_TABS } ?: "home"
    context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
      .edit().putString(PhoneCanDoServeService.KEY_PENDING_TAB, tab).apply()
    PhoneCanDoRunnerModule.emitLaunchTab(tab)
    val launch = launchIntent(tab)
      ?: return Response.Status.OK to errorJson("no_activity", "cannot resolve PhoneCanDo launch intent")
    val foreground = isForeground()
    // Foreground: the event already switched tabs; don't relaunch the task.
    val started = if (foreground) {
      true
    } else {
      try {
        context.startActivity(launch)
        true
      } catch (e: Exception) {
        Log.w(TAG, "open PhoneCanDo failed", e)
        false
      }
    }
    val text = if (o.optString("reason") == "unlock") {
      "Phone control is locked — tap to unlock."
    } else {
      "PhoneCanDo finished — tap to return."
    }
    // Background launches can be silently blocked; the notification is the
    // reliable path (its PendingIntent is exempt from that restriction).
    val notified = if (o.optBoolean("notify", false) && !foreground) notifyApp(tab, text) else false
    return Response.Status.OK to okJson(
      JSONObject().put("started", started).put("notified", notified),
    )
  }

  // Ask the app to show its biometric/PIN modal over the chat. The request
  // blocks until the app resolves it (or the timeout), so a successful unlock
  // lets the agent continue in the same turn. The app is the only place the
  // gate can flip; the agent never sees or supplies a credential.
  private fun unlock(o: JSONObject): Pair<Response.Status, String> {
    if (AutomationGate.enabled) {
      return Response.Status.OK to okJson(
        JSONObject().put("requested", false).put("unlocked", true).put("notified", false),
      )
    }
    val future = CompletableFuture<Boolean>()
    pendingUnlock = future
    val prefs = context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(PhoneCanDoServeService.KEY_PENDING_TAB, "home")
      .putString(PhoneCanDoServeService.KEY_PENDING_UNLOCK, "phone_control")
      .apply()
    PhoneCanDoRunnerModule.emitLaunchTab("home")
    PhoneCanDoRunnerModule.emitUnlockRequest("phone_control")
    val foreground = isForeground()
    val notified = if (!foreground) {
      val launch = launchIntent("home")
      if (launch != null) {
        runCatching { context.startActivity(launch) }
        notifyApp("home", "Phone control is locked — tap to unlock.")
      } else false
    } else false
    val waitMs = o.optLong("waitMs", 45_000).coerceIn(5_000, 90_000)
    val deadline = System.currentTimeMillis() + waitMs
    try {
      while (!future.isDone && !AutomationGate.enabled && System.currentTimeMillis() < deadline) {
        Thread.sleep(100)
      }
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    } finally {
      if (pendingUnlock === future) pendingUnlock = null
      prefs.edit().remove(PhoneCanDoServeService.KEY_PENDING_UNLOCK).apply()
    }
    val unlocked = AutomationGate.enabled || future.getNow(false)
    return Response.Status.OK to okJson(
      JSONObject().put("requested", true).put("unlocked", unlocked).put("notified", notified),
    )
  }

  // Ask the app to show an in-chat confirmation before opening Android's
  // Accessibility settings. The app opens the system screen only after the
  // user confirms, then the bridge waits for the PhoneCanDo service to connect.
  // The user must flip the system toggle; the agent cannot. Safe to call while
  // phone control is locked.
  private fun accessibility(o: JSONObject): Pair<Response.Status, String> {
    if (PceAuto.service != null) {
      return Response.Status.OK to okJson(
        JSONObject().put("opened", false).put("enabled", true).put("notified", false),
      )
    }
    val future = CompletableFuture<Boolean>()
    pendingAccessibility = future
    val prefs = context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(PhoneCanDoServeService.KEY_PENDING_TAB, "home")
      .putString(PhoneCanDoServeService.KEY_PENDING_ACCESSIBILITY, "accessibility")
      .apply()
    PhoneCanDoRunnerModule.emitLaunchTab("home")
    PhoneCanDoRunnerModule.emitAccessibilityRequest("accessibility")
    val foreground = isForeground()
    val notified = if (!foreground) {
      val launch = launchIntent("home")
      if (launch != null) {
        runCatching { context.startActivity(launch) }
        notifyApp("home", "Accessibility permission needed — tap to review.")
      } else false
    } else false
    try {
      val decisionMs = o.optLong("waitMs", 20_000).coerceIn(5_000, 60_000)
      val decisionDeadline = System.currentTimeMillis() + decisionMs
      try {
        while (!future.isDone && System.currentTimeMillis() < decisionDeadline) {
          Thread.sleep(100)
        }
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
      if (!future.getNow(false)) {
        return Response.Status.OK to okJson(
          JSONObject().put("opened", false).put("enabled", false).put("notified", notified),
        )
      }
      val enableMs = o.optLong("enableMs", 40_000).coerceIn(10_000, 90_000)
      val enableDeadline = System.currentTimeMillis() + enableMs
      try {
        while (PceAuto.service == null && System.currentTimeMillis() < enableDeadline) {
          Thread.sleep(200)
        }
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
      return Response.Status.OK to okJson(
        JSONObject()
          .put("opened", true)
          .put("enabled", PceAuto.service != null)
          .put("notified", notified),
      )
    } finally {
      if (pendingAccessibility === future) pendingAccessibility = null
      prefs.edit().remove(PhoneCanDoServeService.KEY_PENDING_ACCESSIBILITY).apply()
    }
  }

  private fun launchIntent(tab: String): Intent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      putExtra("phonecando.tab", tab)
    }

  private fun notifyApp(tab: String, text: String): Boolean {
    val launch = launchIntent(tab) ?: return false
    return notifyIntent(launch, "PhoneCanDo", text)
  }

  private fun notifyIntent(intent: Intent, title: String, text: String): Boolean {
    val pending = PendingIntent.getActivity(
      context, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(AGENT_CHANNEL, "PhoneCanDo agent", NotificationManager.IMPORTANCE_DEFAULT)
    )
    val n = Notification.Builder(context, AGENT_CHANNEL)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setContentIntent(pending)
      .setAutoCancel(true)
      .build()
    nm.notify(UNLOCK_NOTIF, n)
    return runCatching { nm.areNotificationsEnabled() }.getOrDefault(false)
  }

  private fun isForeground(): Boolean {
    val am = context.getSystemService(ActivityManager::class.java) ?: return false
    val pid = Process.myPid()
    return am.runningAppProcesses?.any {
      it.pid == pid && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    } == true
  }

  private fun clipboard(o: JSONObject): Pair<Response.Status, String> {
    val cm = context.getSystemService(ClipboardManager::class.java)
    when (o.optString("action")) {
      "set" -> {
        val text = o.optString("text")
        cm.setPrimaryClip(ClipData.newPlainText("PhoneCanDo", text))
        return Response.Status.OK to okJson(JSONObject().put("text", text))
      }
      "get" -> {
        val clip = runCatching { cm.primaryClip }.getOrNull()
        val text = if (clip != null && clip.itemCount > 0) {
          runCatching { clip.getItemAt(0).coerceToText(context)?.toString() }.getOrNull()
        } else null
        // API 29+ returns nothing to background apps; say so instead of "".
        return Response.Status.OK to okJson(
          JSONObject()
            .put("text", text ?: JSONObject.NULL)
            .put("available", !text.isNullOrEmpty())
        )
      }
      else -> return Response.Status.BAD_REQUEST to errorJson("bad_request", "action must be get or set")
    }
  }

  private fun flavor(): String = try {
    val ai = context.packageManager.getApplicationInfo(
      context.packageName,
      android.content.pm.PackageManager.GET_META_DATA,
    )
    ai.metaData?.getString("com.phonecando.automation") ?: "full"
  } catch (_: Exception) {
    "full"
  }

  private fun json(status: Response.Status, body: String): Response =
    newFixedLengthResponse(status, "application/json; charset=utf-8", body)

  private fun okJson(data: JSONObject) = JSONObject().put("ok", true).put("data", data).toString()

  private fun errorJson(code: String, message: String) =
    JSONObject().put("ok", false).put("code", code).put("message", message).toString()

  companion object {
    private const val TAG = "PhoneCanDoBridge"
    private const val AGENT_CHANNEL = "phonecando-agent"
    private const val NOTIF_BASE = 4600
    private const val UNLOCK_NOTIF = 4601
    private const val PREFERRED_PORT = 9998
    private const val TIMEOUT_MS = 10_000
    private const val MAX_BODY = 256L * 1024
    private val ALLOWED_SCHEMES = setOf("http", "https", "mailto", "tel", "geo", "market")
    private val APP_TABS = setOf("home", "env", "settings")

    // The app's unlock modal resolves this when the user finishes biometrics
    // (or cancels). The bridge request blocks until then, so the agent can
    // continue in the same turn after a successful unlock.
    @Volatile
    private var pendingUnlock: CompletableFuture<Boolean>? = null
    @Volatile
    private var pendingAccessibility: CompletableFuture<Boolean>? = null

    fun resolveUnlock(ok: Boolean) {
      pendingUnlock?.complete(ok)
    }

    fun resolveAccessibility(ok: Boolean) {
      pendingAccessibility?.complete(ok)
    }

    // NanoHTTPD binds in start(), not in the constructor: try the fixed door,
    // then let the OS assign a free one. The second attempt is the real
    // fallback; a taken 9998 must not strand the bridge.
    fun open(context: Context, token: String, onCall: () -> Unit = {}): BridgeServer? {
      for (port in intArrayOf(PREFERRED_PORT, 0)) {
        val server = BridgeServer(context, token, port, onCall)
        try {
          server.start(TIMEOUT_MS, false)
          server.url = "http://127.0.0.1:${server.listeningPort}"
          Log.i(TAG, "bridge on ${server.url}")
          return server
        } catch (e: IOException) {
          Log.w(TAG, "bridge bind on $port failed", e)
          server.stop()
        }
      }
      Log.w(TAG, "bridge bind failed")
      return null
    }
  }
}
