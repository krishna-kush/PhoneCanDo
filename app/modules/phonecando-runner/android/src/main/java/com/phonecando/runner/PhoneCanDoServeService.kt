package com.phonecando.runner

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.EngineRequests
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.ServiceNotification
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

// The foreground service (dataSync) that keeps the agents' engines alive
// while the app is in the background. The engines themselves live in the
// process's EngineSupervisor (engine/); this service is their anchor: it
// runs start requests (ACTION_START from the module's startEngine, one at a
// time on its own thread), shows one notification listing the running
// agents, and stops itself once nothing runs. Nothing restarts it: every
// command answers START_NOT_STICKY, and a null-intent restart starts
// nothing (the app ensures its engines again when it comes to the
// foreground).
class PhoneCanDoServeService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private lateinit var starts: ExecutorService
  private lateinit var notification: ServiceNotification

  // Main thread only. A stop is stopSelf(lastStartId): a newer
  // startForegroundService() may already be queued, and stopping under it
  // crashes the app (ForegroundServiceDidNotStartInTimeException); with the
  // id the system ignores the stop and that start decides instead.
  private var lastStartId = 0
  private val pendingRequests = LinkedHashSet<String>()
  private var pendingStarts = 0

  private val engineListener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      main.post { render() }
    }

    override fun onIdle() {
      main.post { stopIfIdle() }
    }

    override fun onChats() {
      main.post { render() }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    // Normally done by TelemetryInitProvider at process start; repeated here
    // (idempotent) so engine counters never depend on it.
    TelemetryRecorder.install(applicationContext)
    notification = ServiceNotification(this).also { it.createChannel() }
    starts = Executors.newSingleThreadExecutor { r ->
      Thread(r, "phonecando-engine-start").apply { isDaemon = true }
    }
    Engines.addListener(engineListener)
    goForeground()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    // Every startForegroundService() wants a startForeground() back.
    goForeground()
    if (intent?.action == ACTION_START) {
      val agentId = intent.getStringExtra(EXTRA_AGENT_ID)
      val requestId = intent.getStringExtra(EXTRA_REQUEST_ID)
      if (agentId.isNullOrEmpty()) {
        EngineRequests.complete(requestId, failure("no agent given"))
      } else {
        runStart(agentId, requestId, requestedAt(intent))
        return START_NOT_STICKY
      }
    }
    // A null-intent restart or nothing to do: start nothing.
    stopIfIdle()
    return START_NOT_STICKY
  }

  private fun runStart(agentId: String, requestId: String?, requestedAt: Long) {
    pendingStarts++
    requestId?.let(pendingRequests::add)
    val supervisor = Engines.get(this)
    try {
      starts.execute {
        val result = runCatching { supervisor.start(agentId, requestedAt) }
        EngineRequests.complete(requestId, result)
        main.post {
          pendingStarts--
          requestId?.let(pendingRequests::remove)
          render()
          stopIfIdle()
        }
      }
    } catch (_: RejectedExecutionException) {
      pendingStarts--
      requestId?.let(pendingRequests::remove)
      EngineRequests.complete(requestId, failure("the engine service is stopping"))
    }
  }

  // The module stamps start intents with the JS request time, so boot time
  // includes the service's own start. Missing or implausible (another boot,
  // clock skew) means now.
  private fun requestedAt(intent: Intent): Long {
    val now = SystemClock.elapsedRealtime()
    val stamped = intent.getLongExtra(EXTRA_REQUESTED_AT, 0L)
    return if (stamped in 1..now && now - stamped < MAX_REQUEST_AGE_MS) stamped else now
  }

  private fun stopIfIdle() {
    if (pendingStarts == 0 && Engines.peek()?.anyLive() != true) stopSelf(lastStartId)
  }

  override fun onDestroy() {
    Engines.removeListener(engineListener)
    starts.shutdownNow()
    for (id in pendingRequests) EngineRequests.complete(id, failure("the engine service stopped"))
    pendingRequests.clear()
    main.removeCallbacksAndMessages(null)
    // Engines still running (the system ended the service): end them off
    // the main thread, which can take up to 3 s. When nothing runs, a start
    // that arrives right after must not be caught by a late stop-all.
    Engines.peek()?.takeIf { it.anyLive() }?.stopAllAsync()
    super.onDestroy()
  }

  // Android 15+ lets dataSync foreground services run 6 hours in any 24
  // while the app is in the background (bringing the app to the foreground
  // resets the clock). At the limit Android calls this and allows a few
  // seconds to stop; a service still running then crashes the whole process
  // (RemoteServiceException), taking the bridge and the accessibility host
  // with it. So drop the notification and stop at once; the engines end on
  // their own thread (all of them within one 3 s grace). The app starts them
  // again on its next foreground, which has reset the clock.
  override fun onTimeout(startId: Int, fgsType: Int) {
    Log.w(TAG, "foreground service time limit reached (type $fgsType), stopping")
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    Engines.peek()?.stopAllAsync()
  }

  private fun goForeground() {
    try {
      startForeground(
        ServiceNotification.NOTIFICATION_ID, content(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } catch (e: Exception) {
      Log.w(TAG, "startForeground refused", e)
    }
  }

  private fun render() {
    try {
      getSystemService(NotificationManager::class.java)
        .notify(ServiceNotification.NOTIFICATION_ID, content())
    } catch (e: Exception) {
      Log.w(TAG, "notification update failed", e)
    }
  }

  // The chats the engines are busy with, each with its agent's name.
  private fun content(): Notification {
    val supervisor = Engines.peek()
    val names = AgentStores.get(this).all().associate { it.id to it.name }
    val running = supervisor?.statuses()?.filter { it.state.live }?.map { it.agentId }.orEmpty()
    return notification.build(supervisor?.chats().orEmpty(), names, running)
  }

  private fun failure(detail: String): Result<Int> =
    Result.failure(EngineStartException(EngineStartError.START_FAILED, detail))

  companion object {
    const val TAG = "PhoneCanDoServeService"
    const val ACTION_START = "com.phonecando.runner.START_ENGINE"
    const val EXTRA_AGENT_ID = "agentId"
    const val EXTRA_REQUEST_ID = "requestId"
    const val EXTRA_REQUESTED_AT = "requestedAtElapsed"
    private const val MAX_REQUEST_AGE_MS = 10 * 60_000L

    // The runner's own prefs file: the launch target waiting for the app
    // (notify/LaunchTargets), the notification-permission ask, the
    // self-update mark, the accessibility-connected flag. Engine state lives
    // in agents.json.
    const val PREFS = "phonecando-engine"
  }
}
