package com.phonecando.runner

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import java.io.File

class PhoneCanDoServeService : Service() {
  private var serveProcess: Process? = null
  private var bridge: BridgeServer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID, "PhoneCanDo engine",
      NotificationManager.IMPORTANCE_LOW
    )
    manager.createNotificationChannel(channel)
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_DONE, "PhoneCanDo finished",
        NotificationManager.IMPORTANCE_DEFAULT,
      )
    )
    val notification = buildNotification("PhoneCanDo engine running", "opencode serve on 127.0.0.1")
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(
        NOTIFICATION_ID, notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      @Suppress("DEPRECATION")
      startForeground(NOTIFICATION_ID, notification)
    }
    startBridge()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSupervisor()
      stopSse()
      stopServeProcess()
      stopSelf()
      return START_NOT_STICKY
    }
    // Open/link/rename report: upsert the watched set (multi-chat: one entry
    // per open chat), retract any completion ping on return, ensure the
    // event stream is up. A link arriving also resolves any pending title.
    if (intent?.action == ACTION_SESSION) {
      stayAwake = false
      idleStrikes = 0
      sessionReported = true
      val sid = intent.getStringExtra(EXTRA_SESSION_ID)?.takeIf { it.isNotEmpty() }
      val title = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotEmpty() }
      if (sid != null) {
        val watched = readMap(KEY_WATCHED_MAP)
        watched[sid] = title ?: watched[sid] ?: "Chat"
        writeMap(KEY_WATCHED_MAP, watched)
        if (postedPings.remove(sid)) {
          try {
            notifyManager().cancel(doneNotifId(sid))
          } catch (_: Exception) {
          }
        }
        val tracked = readMap(KEY_TRACKED_MAP)
        if (tracked.remove(sid) != null) writeMap(KEY_TRACKED_MAP, tracked)
        prefs().edit().putString(KEY_PENDING, "").apply()
      } else if (title != null) {
        // Opened but not yet linked (adopt-or-create resolves seconds later):
        // show the name now; the link push completes the entry.
        prefs().edit().putString(KEY_PENDING, title).apply()
      }
      ensureSse()
      startSupervisor()
      renderNotification()
      return START_STICKY
    }
    // Title-only update: renames watched/tracked entries without touching
    // membership (backfills landing after the chat closed must still reach
    // the notification). Never launches serve, never affects shutdown.
    if (intent?.action == ACTION_TITLE) {
      val sid = intent.getStringExtra(EXTRA_SESSION_ID)?.takeIf { it.isNotEmpty() }
      val title = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotEmpty() }
      if (sid != null && title != null) {
        var changed = false
        val watched = readMap(KEY_WATCHED_MAP)
        if (watched.containsKey(sid)) {
          watched[sid] = title
          writeMap(KEY_WATCHED_MAP, watched)
          changed = true
        }
        val tracked = readMap(KEY_TRACKED_MAP)
        if (tracked.containsKey(sid)) {
          tracked[sid] = title
          writeMap(KEY_TRACKED_MAP, tracked)
          changed = true
        }
        if (changed) renderNotification()
      }
      return START_STICKY
    }
    // Leave report: drop from watched; if generating, keep tracking in the
    // background set so the finish still pings. Idle ones are dropped by the
    // supervisor (no ping — nothing finished).
    if (intent?.action == ACTION_LEAVE) {
      stayAwake = false
      sessionReported = true
      val sid = intent.getStringExtra(EXTRA_SESSION_ID)?.takeIf { it.isNotEmpty() }
      if (sid != null) {
        val watched = readMap(KEY_WATCHED_MAP)
        val title = watched.remove(sid)
        writeMap(KEY_WATCHED_MAP, watched)
        if (title != null) {
          val tracked = readMap(KEY_TRACKED_MAP)
          tracked[sid] = title
          writeMap(KEY_TRACKED_MAP, tracked)
        }
      } else {
        prefs().edit().putString(KEY_PENDING, "").apply()
      }
      ensureSse()
      startSupervisor()
      renderNotification()
      return START_STICKY
    }
    // Explicit stay-awake request (manual Start, chat-open ensure). A null
    // action is a system restart: transient, eligible for quiet shutdown.
    if (intent?.action == ACTION_START) stayAwake = true
    // System restart with no intent: distinguish crash-kill during live use
    // from a truly idle stop. Watched/tracked non-empty means chats were
    // open or runs were finishing when the system killed us — relaunch serve
    // on the saved port so the UI (which saw no AppState transition and
    // won't re-ensure) isn't left staring at a dead engine. Fully unwatched
    // means quiet-when-idle already applied: stay stopped, and any orphaned
    // serve keeps answering health on its own (launching another would only
    // fork a ghost).
    if (intent?.action == null) {
      val watched = readMap(KEY_WATCHED_MAP)
      val tracked = readMap(KEY_TRACKED_MAP)
      if (watched.isEmpty() && tracked.isEmpty()) {
        Log.i(TAG, "null intent restart with nothing watched, staying stopped")
        stopSelf()
        return START_NOT_STICKY
      }
      Log.i(TAG, "null intent restart with live chats, relaunching serve")
      try {
        val port = savedPort() ?: DEFAULT_PORT
        serveProcess = launchServe(port, intent)
        savePort(port)
        ensureSse()
        startSupervisor()
        renderNotification()
      } catch (e: Exception) {
        Log.e(TAG, "serve relaunch failed", e)
        stopSelf()
        return START_NOT_STICKY
      }
      return START_STICKY
    }
    if (serveProcess == null) {
      try {
        val port = resolvePort(intent?.getStringExtra(EXTRA_PORT))
        serveProcess = launchServe(port, intent)
        savePort(port)
        Log.i(TAG, "serve started on $port")
      } catch (e: Exception) {
        Log.e(TAG, "serve start failed", e)
        stopSelf()
        return START_NOT_STICKY
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopSupervisor()
    stopSse()
    stopServeProcess()
    bridge?.stop()
    bridge = null
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Nothing to do: the supervisor keeps working sessions alive with live
    // status and shuts down idle ones on its own (quiet-when-idle).
  }

  private fun stopServeProcess() {
    try {
      serveProcess?.destroy()
      serveProcess?.waitFor()
    } catch (_: Exception) {
    }
    serveProcess = null
  }

  // Agent bridge: loopback HTTP for the mobile_* tools. Token is install-stable
  // (like the serve password) so a service restart doesn't strand an orphaned
  // serve whose plugin still holds the old env. URL goes to prefs for adb
  // debugging; serve gets both via env at launch.
  private fun startBridge() {
    if (bridge != null) return
    val token = prefs().getString(KEY_BRIDGE_TOKEN, null)?.takeIf { it.isNotEmpty() }
      ?: java.util.UUID.randomUUID().toString().replace("-", "").let {
        prefs().edit().putString(KEY_BRIDGE_TOKEN, it).apply()
        it
      }
    val server = BridgeServer.open(applicationContext, token) {
      // A live agent turn may background PhoneCanDo (mobile_home/launch). Keep the
      // bridge/serve alive through the task instead of treating that as idle.
      lastBridgeCall = System.currentTimeMillis()
    }
    if (server == null) {
      Log.w(TAG, "agent bridge failed to bind")
      return
    }
    bridge = server
    prefs().edit().putString(KEY_BRIDGE_URL, server.url).apply()
  }

  // Seed agent config (Slice 0): serve reads global config from
  // $HOME/.config/opencode (HOME=phonecando-home). The module's Gradle
  // syncAgentConfig task packages opencode-config/ into assets at build time.
  // plugins/skills/AGENTS.md refresh every start; opencode.json seeds only when
  // absent so user edits and BYOK keys survive restarts.
  private fun seedAgentConfig(home: File) {
    try {
      val top = assets.list("opencode-config")?.toSet() ?: emptySet()
      if (top.isEmpty()) return // dev build without staged config: skip silently
      val dest = File(home, ".config/opencode").apply { mkdirs() }
      for (name in top) {
        val target = File(dest, name)
        if (name == "opencode.json" && target.exists()) continue
        copyAssetPath("opencode-config/$name", target)
      }
    } catch (e: Exception) {
      Log.w(TAG, "agent config seed failed", e)
    }
  }

  private fun copyAssetPath(assetPath: String, target: File) {
    val kids = try {
      assets.list(assetPath)
    } catch (_: Exception) {
      null
    }
    if (kids == null || kids.isEmpty()) {
      try {
        target.parentFile?.mkdirs()
        assets.open(assetPath).use { inp ->
          target.outputStream().use { out -> inp.copyTo(out) }
        }
      } catch (_: Exception) {
        target.mkdirs() // empty dir
      }
      return
    }
    target.mkdirs()
    for (child in kids) copyAssetPath("$assetPath/$child", File(target, child))
  }

  private fun launchServe(port: String, intent: Intent?): Process {
    val prefix = filesDir
    val home = File(prefix, "phonecando-home").apply { mkdirs() }
    seedAgentConfig(home)
    // No model pin: fresh sessions inherit the upstream default. (A
    // big-pickle pin lived here while exo-free 503'd; removed per user call —
    // fresh chats now prove whatever the current upstream default does.)
    // The engine is a native bionic binary executed directly (its INTERP is
    // the OS linker). Renderer lib path + filewatcher-disable come from the
    // wrapper contract.
    val libDir = intent?.getStringExtra(EXTRA_LIB_DIR) ?: applicationInfo.nativeLibraryDir
    val binary = File(intent?.getStringExtra(EXTRA_BINARY) ?: "$libDir/libopencode2.so")
    require(binary.exists()) { "opencode binary missing: ${binary.absolutePath}" }
    if (!binary.canExecute()) binary.setExecutable(true)

    val pb = ProcessBuilder(
      binary.absolutePath,
      "serve", "--port", port, "--hostname", "127.0.0.1"
    )
    pb.directory(home)
    // v2 serve is auth-first. We generate one stable password per install
    // (not per boot) and hand it to serve via env: deterministic for every
    // consumer (SSE, native health, JS bridge) with no log parsing and no
    // rotation races on restart. Loopback-only, so prefs storage is fine.
    val pw = prefs().getString(KEY_PASSWORD, null)?.takeIf { it.isNotEmpty() }
      ?: java.util.UUID.randomUUID().toString().replace("-", "").let {
        prefs().edit().putString(KEY_PASSWORD, it).apply()
        it
      }
    pb.environment().apply {
      put("HOME", home.absolutePath)
      put("OPENCODE_DISABLE_AUTOUPDATE", "1")
      put("OPENCODE_DISABLE_LSP_DOWNLOAD", "1")
      put("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER", "true")
      put("OPENCODE_SERVER_PASSWORD", pw)
      put("OPENTUI_LIB_PATH", "$libDir/libopentui.so")
      bridge?.let {
        put("PHONECANDO_BRIDGE_URL", it.url)
        put("PHONECANDO_BRIDGE_TOKEN", it.token)
      }
      // The mobile plugin hides UI tools in play builds (they would only 503).
      put(
        "PHONECANDO_AUTOMATION",
        try {
          packageManager.getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA)
            .metaData?.getString("com.phonecando.automation") ?: "full"
        } catch (_: Exception) {
          "full"
        },
      )
      put("TMPDIR", home.absolutePath)
      intent?.getStringExtra(EXTRA_SSL_CERT)?.let { put("SSL_CERT_FILE", it) }
    }
    pb.redirectOutput(File(home, "serve.log"))
    pb.redirectErrorStream(true)
    return pb.start()
  }

  companion object {
    const val TAG = "PhoneCanDoServeService"
    const val CHANNEL_ID = "phonecando-engine"
    const val NOTIFICATION_ID = 4101
    const val ACTION_START = "com.phonecando.runner.START_SERVE"
    const val ACTION_STOP = "com.phonecando.runner.STOP_SERVE"
    const val ACTION_SESSION = "com.phonecando.runner.ACTIVE_SESSION"
    const val ACTION_LEAVE = "com.phonecando.runner.LEAVE_SESSION"
    const val ACTION_TITLE = "com.phonecando.runner.SESSION_TITLE"
    const val EXTRA_BINARY = "binary"
    const val EXTRA_PORT = "port"
    const val EXTRA_LIB_DIR = "libDir"
    const val EXTRA_SSL_CERT = "sslCertFile"
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_TITLE = "title"
    const val PREFS = "phonecando-engine"
    const val KEY_PORT = "serve_port"
    const val KEY_PASSWORD = "serve_password"
    const val KEY_BRIDGE_TOKEN = "bridge_token"
    const val KEY_BRIDGE_URL = "bridge_url"
    const val KEY_PENDING_TAB = "pending_tab"
    const val KEY_PENDING_UNLOCK = "pending_unlock"
    const val KEY_PENDING_ACCESSIBILITY = "pending_accessibility"
    const val KEY_WATCHED_MAP = "watched_chats"
    const val KEY_TRACKED_MAP = "tracked_chats"
    const val KEY_PENDING = "pending_title"
    const val CHANNEL_DONE = "phonecando-done"
    const val DONE_ID_BASE = 4300
    const val DEFAULT_PORT = "4097"
    const val IDLE_TEXT = "○ Idle"
    const val WORKING_TEXT = "● Working…"
    const val SUPERVISOR_INTERVAL_MS = 30_000L
    const val BRIDGE_GRACE_MS = 5 * 60_000L
  }

  // Live notification: the service owns the text because it outlives the UI
  // (swipe-away kills JS, not the service). Tapping it reopens the app.
  private fun notifyManager() = getSystemService(NotificationManager::class.java)

  private fun buildNotification(title: String, text: String): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(launch)
      .setOngoing(true)
      .build()
  }

  private fun pushNotification(title: String, text: String) {
    notifyManager().notify(NOTIFICATION_ID, buildNotification(title, text))
  }

  private fun pushNeutral() {
    pushNotification("PhoneCanDo engine running", "opencode serve on 127.0.0.1")
  }

  // Event-driven watch: one SSE stream (`/global/event`) feeds a pure state
  // machine; the notification renders on events, not on a poll cadence.
  // Watched = chats currently open. Tracked = left-while-open sessions kept
  // until their run finishes (then they ping once with sound and are
  // dropped). A 30s supervisor only heals (SSE reconnect), drops idle
  // tracked entries, and shuts down a fully unwatched idle engine.
  private val watchLock = Any()
  private val watch = WatchState()
  private var sse: SseClient? = null
  private var ssePort: String? = null
  private var ssePassword: String? = null
  private val postedPings = mutableSetOf<String>()
  private var supThread: HandlerThread? = null
  private var supHandler: Handler? = null
  private var stayAwake = false
  private var idleStrikes = 0
  @Volatile private var lastBridgeCall = 0L
  // True once any SESSION report arrived in this lifetime. Guards quiet
  // shutdown: native code predating the UI reports must never trigger it.
  private var sessionReported = false

  private fun readMap(key: String): MutableMap<String, String> {
    val out = mutableMapOf<String, String>()
    try {
      val o = org.json.JSONObject(prefs().getString(key, "{}") ?: "{}")
      o.keys().forEach { k -> out[k] = o.optString(k, "") }
    } catch (_: Exception) {
    }
    return out
  }

  private fun writeMap(key: String, m: Map<String, String>) {
    try {
      val o = org.json.JSONObject()
      m.forEach { (k, v) -> o.put(k, v) }
      prefs().edit().putString(key, o.toString()).apply()
    } catch (_: Exception) {
    }
  }

  private fun doneNotifId(sid: String): Int = DONE_ID_BASE + (Math.abs(sid.hashCode()) % 500)

  private fun launchPendingIntent(): PendingIntent? {
    return packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }

  private fun ensureSse() {
    val port = savedPort() ?: DEFAULT_PORT
    val pw = prefs().getString(KEY_PASSWORD, null)?.takeIf { it.isNotEmpty() }
    // Password rotates on every serve restart: same port + stale auth would
    // 401-reconnect forever, so the password is part of the identity check.
    if (sse != null && sse!!.isAlive() && ssePort == port && ssePassword == pw) return
    try {
      sse?.stop()
    } catch (_: Exception) {
    }
    ssePort = port
    ssePassword = pw
    sse = SseClient("http://127.0.0.1:$port/api/event", TAG, ::onEngineEvent, pw).also {
      it.start()
    }
  }

  private fun stopSse() {
    try {
      sse?.stop()
    } catch (_: Exception) {
    }
    sse = null
    ssePort = null
    ssePassword = null
  }

  private fun startSupervisor() {
    if (supThread == null) {
      supThread = HandlerThread("phonecando-sup").also { it.start() }
    }
    if (supHandler == null) {
      supHandler = Handler(supThread!!.looper).also { it.post(supervisorTick) }
    }
  }

  private fun stopSupervisor() {
    supHandler?.removeCallbacks(supervisorTick)
    supHandler = null
    supThread?.quitSafely()
    supThread = null
  }

  private val supervisorTick = object : Runnable {
    override fun run() {
      try {
        supervisorPass()
      } catch (_: Exception) {
      }
      supHandler?.postDelayed(this, SUPERVISOR_INTERVAL_MS)
    }
  }

  private fun supervisorPass() {
    synchronized(watchLock) {
      val watched = readMap(KEY_WATCHED_MAP)
      val tracked = readMap(KEY_TRACKED_MAP)
      if (watched.isNotEmpty() || tracked.isNotEmpty()) ensureSse()
      // Drop idle tracked entries silently (nothing finished — no ping).
      var changed = false
      tracked.keys.toList().forEach { sid ->
        if (!watch.isWorking(sid)) {
          tracked.remove(sid)
          watch.drop(sid)
          changed = true
        }
      }
      if (changed) {
        writeMap(KEY_TRACKED_MAP, tracked)
        renderNotificationLocked()
      }
      val anyWorking = watched.keys.any { watch.isWorking(it) } ||
        tracked.keys.any { watch.isWorking(it) }
      val bridgeActive =
        System.currentTimeMillis() - lastBridgeCall < BRIDGE_GRACE_MS
      // Never shut down while a chat is open (watched non-empty): an idle
      // open chat keeps its engine — shutdown is only for the unwatched.
      // A recent bridge call means an agent turn may be between tools after
      // mobile_home; keep the bridge alive through that gap too.
      if (!anyWorking && watched.isEmpty() && !bridgeActive) {
        idleStrikes++
        if (idleStrikes >= 2 && sessionReported && !stayAwake) shutdownQuietly()
      } else {
        idleStrikes = 0
      }
    }
  }

  private fun onEngineEvent(p: EngineEvent.Parsed) {
    val sid = p.sessionId
    if (sid == null) {
      // Parser miss on a meaningful event = blind spot. Logged so a live
      // capture can show which frame shape wasn't handled.
      if (p.kind != EngineEvent.Kind.OTHER) Log.w(TAG, "event without session: $p")
      return
    }
    synchronized(watchLock) {
      val watched = readMap(KEY_WATCHED_MAP)
      val tracked = readMap(KEY_TRACKED_MAP)
      if (!watched.containsKey(sid) && !tracked.containsKey(sid)) return // not ours
      when (p.kind) {
        EngineEvent.Kind.WORKING -> {
          if (watch.apply(EngineEvent.Kind.WORKING, sid)) renderNotificationLocked()
        }
        EngineEvent.Kind.FINISHED, EngineEvent.Kind.FAILED -> {
          val was = watch.apply(p.kind, sid)
          if (sid in tracked && sid !in watched) {
            // Finished while away: sounding one-shot ping, then forget it.
            // Watched finishes stay silent (the user is looking).
            postDone(sid, tracked[sid] ?: "Chat", p.kind == EngineEvent.Kind.FAILED)
            tracked.remove(sid)
            writeMap(KEY_TRACKED_MAP, tracked)
            renderNotificationLocked()
          } else if (was) {
            renderNotificationLocked()
          }
        }
        EngineEvent.Kind.GONE -> {
          watch.drop(sid)
          var changed = false
          if (watched.remove(sid) != null) {
            writeMap(KEY_WATCHED_MAP, watched)
            changed = true
          }
          if (tracked.remove(sid) != null) {
            writeMap(KEY_TRACKED_MAP, tracked)
            changed = true
          }
          if (changed) renderNotificationLocked()
        }
        EngineEvent.Kind.OTHER -> {
        }
      }
    }
  }

  private fun postDone(sid: String, title: String, failed: Boolean) {
    val n = Notification.Builder(this, CHANNEL_DONE)
      .setContentTitle(if (failed) "✕ Failed: $title" else "✓ Finished: $title")
      .setContentText("Tap to view")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(launchPendingIntent())
      .setAutoCancel(true)
      .build()
    notifyManager().notify(doneNotifId(sid), n)
    postedPings.add(sid)
  }

  private fun renderNotification() {
    synchronized(watchLock) {
      renderNotificationLocked()
    }
  }

  private fun renderNotificationLocked() {
    val watched = readMap(KEY_WATCHED_MAP)
    val tracked = readMap(KEY_TRACKED_MAP)
    val pending = prefs().getString(KEY_PENDING, null)?.takeIf { it.isNotEmpty() }
    data class Line(val text: String, val working: Boolean)
    val lines = mutableListOf<Line>()
    watched.forEach { (sid, t) -> lines += Line(t, watch.isWorking(sid)) }
    tracked.forEach { (sid, t) -> if (watch.isWorking(sid)) lines += Line(t, true) }
    if (pending != null && lines.isEmpty()) lines += Line(pending, false)
    if (lines.isEmpty()) {
      pushNeutral()
      return
    }
    if (lines.size == 1) {
      val l = lines[0]
      pushNotification(l.text, if (l.working) WORKING_TEXT else IDLE_TEXT)
      return
    }
    val working = lines.count { it.working }
    val style = Notification.InboxStyle()
    lines.take(5).forEach { style.addLine((if (it.working) "● " else "○ ") + it.text) }
    style.setSummaryText("$working of ${lines.size} working")
    val n = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(if (working > 0) "$working chats working" else "PhoneCanDo chats")
      .setContentText(lines.take(5).joinToString(" · ") { (if (it.working) "● " else "○ ") + it.text })
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(launchPendingIntent())
      .setOngoing(true)
      .setStyle(style)
      .build()
    notifyManager().notify(NOTIFICATION_ID, n)
  }

  private fun shutdownQuietly() {
    Log.i(TAG, "idle and unwatched, stopping")
    stopSupervisor()
    stopSse()
    stopServeProcess()
    stopSelf()
  }

  private fun prefs() = getSharedPreferences(PREFS, MODE_PRIVATE)

  private fun savedPort(): String? =
    prefs().getString(KEY_PORT, null)?.takeIf { it.isNotEmpty() }

  private fun savePort(port: String) {
    prefs().edit().putString(KEY_PORT, port).apply()
  }

  // Effective port: explicit request wins; otherwise the last-good port from
  // prefs (covers a system restart arriving with a null intent); otherwise
  // the default. If the chosen door is already bound (stale ghost socket),
  // fall back to an OS-assigned free loopback port so start never fails on
  // a squatted door.
  private fun resolvePort(requested: String?): String {
    val want = requested?.takeIf { it.isNotEmpty() } ?: savedPort() ?: DEFAULT_PORT
    val num = want.toIntOrNull() ?: DEFAULT_PORT.toInt()
    if (isPortFree(num)) return num.toString()
    Log.w(TAG, "port $num occupied, picking a free one")
    return pickFreePort().toString()
  }

  private fun isPortFree(port: Int): Boolean {
    return try {
      java.net.ServerSocket().use { s ->
        s.reuseAddress = true
        s.bind(java.net.InetSocketAddress("127.0.0.1", port))
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun pickFreePort(): Int {
    java.net.ServerSocket().use { s ->
      s.bind(java.net.InetSocketAddress("127.0.0.1", 0))
      return s.localPort
    }
  }
}
