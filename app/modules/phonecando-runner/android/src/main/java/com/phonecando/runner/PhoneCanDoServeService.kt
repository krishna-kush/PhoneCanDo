package com.phonecando.runner

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.phonecando.models.jobs.JobTarget
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.EngineRequests
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.jobs.JobsAnchor
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.notify.LinuxJobLines
import com.phonecando.runner.notify.ReadingLines
import com.phonecando.runner.notify.ServiceNotification
import com.phonecando.runner.notify.TimeLimitNotice
import com.phonecando.runner.notify.TransferLines
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

// The foreground service that keeps the agents' engines alive while the app
// is in the background, and the process while a model job (download,
// import) or a Linux job (env download, machine setup, agent install)
// runs. Its type is specialUse, which Android gives no time limit
// (dataSync gets 6 hours in 24 on Android 15+). The engines themselves live
// in the process's EngineSupervisor (engine/), the jobs in the models and
// Linux modules' hosts; this service is their anchor: it runs start
// requests (ACTION_START from the module's startEngine, one at a time on
// its own thread), holds for jobs (ACTION_HOLD, jobs/JobsAnchor), shows
// one notification listing the running agents' chats, the model server
// reading a prompt and the jobs, and stops itself once nothing has run for
// 10 s (stopIfIdle).
// Nothing restarts it: every command answers START_NOT_STICKY, and a
// null-intent restart starts nothing (the app ensures its engines again
// when it comes to the foreground).
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

  // Main thread only. Set by onTimeout: from then on nothing posts the
  // notification again (it would come back as a plain one that nothing
  // removes).
  private var timedOut = false

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

    override fun onPrompt(reading: PromptReading?) {
      main.post { render() }
    }
  }

  // Jobs begin, end and move on (at most every 2 s each).
  private val jobsListener = JobsAnchor.Listener {
    main.post {
      render()
      stopIfIdle()
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
    JobsAnchor.install(this)
    JobsAnchor.addListener(jobsListener)
    JobsAnchor.service(up = true)
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
    // ACTION_HOLD (a job runs), a null-intent restart or nothing to
    // do: start nothing; stay while a job runs.
    render()
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

  // Nothing runs: stop, but only after LINGER_MS with still nothing. Work
  // often follows at once (an agent's install starts as its machine's setup
  // ends), by then the app may be in the background, and there Android
  // refuses a new start of this service: the next job would run unheld and
  // the process freeze.
  private fun stopIfIdle() {
    if (!idle()) return
    main.removeCallbacks(stopWhenStillIdle)
    main.postDelayed(stopWhenStillIdle, LINGER_MS)
  }

  private val stopWhenStillIdle = Runnable { if (idle()) stopSelf(lastStartId) }

  private fun idle(): Boolean =
    pendingStarts == 0 && Engines.peek()?.anyLive() != true && !JobsAnchor.anyRunning()

  override fun onDestroy() {
    Engines.removeListener(engineListener)
    JobsAnchor.removeListener(jobsListener)
    // Jobs still running (the system ended the service): the next job
    // event asks for the service again.
    JobsAnchor.service(up = false)
    starts.shutdownNow()
    for (id in pendingRequests) EngineRequests.complete(id, failure("the engine service stopped"))
    pendingRequests.clear()
    main.removeCallbacksAndMessages(null)
    // Engines still running (the system ended the service): end them off
    // the main thread, which can take up to 3 s. When nothing runs, a start
    // that arrives right after must not be caught by a late stop-all.
    Engines.peek()?.takeIf { it.anyLive() }?.stopAllAsync(if (timedOut) TIME_LIMIT_REASON else null)
    super.onDestroy()
  }

  // specialUse has no time limit, so this should never come. It stays for
  // a limit a later Android may set: Android calls it at the limit and
  // allows a few seconds to stop; a service still running then crashes the
  // whole process (RemoteServiceException), taking the bridge and the
  // accessibility host with it. So drop the notification and stop at once;
  // the engines end on their own thread (all of them within one 3 s grace)
  // with the reason on their statuses, and a notice says so. Jobs keep
  // running while the process lives and resume later where they stopped.
  // The app starts the active agent's engine again on its next foreground.
  override fun onTimeout(startId: Int, fgsType: Int) {
    Log.w(TAG, "foreground service time limit reached (type $fgsType), stopping")
    timedOut = true
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    Engines.peek()?.takeIf { it.anyLive() }?.let {
      it.stopAllAsync(TIME_LIMIT_REASON)
      TimeLimitNotice.post(this)
    }
  }

  private fun goForeground() {
    // The manifest's type below Android 14, where specialUse does not exist.
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST
    }
    try {
      startForeground(ServiceNotification.NOTIFICATION_ID, content(), type)
    } catch (e: Exception) {
      Log.w(TAG, "startForeground refused", e)
    }
  }

  private fun render() {
    if (timedOut) return
    try {
      getSystemService(NotificationManager::class.java)
        .notify(ServiceNotification.NOTIFICATION_ID, content())
    } catch (e: Exception) {
      Log.w(TAG, "notification update failed", e)
    }
  }

  // The chats the engines are busy with, each with its agent's name, the
  // prompt a model server reads, the model jobs and the Linux jobs.
  private fun content(): Notification {
    val supervisor = Engines.peek()
    val agents = AgentStores.get(this).all()
    val names = agents.associate { it.id to it.name }
    val running = supervisor?.statuses()?.filter { it.state.live }?.map { it.agentId }.orEmpty()
    val transfers = JobsAnchor.modelJobs().map {
      TransferLines.of(it.label, it.target.kind == JobTarget.Kind.IMPORT, it.done, it.total)
    }
    val linux = LinuxJobLines.of(JobsAnchor.linuxJobs(), JobsAnchor::envName) { image ->
      agents.firstOrNull { it.imageId == image }?.name
    }
    val reading = supervisor?.promptReading()?.let { ReadingLines.of(it.modelName, it.read) }
    return notification.build(supervisor?.chats().orEmpty(), names, running, transfers, reading, linux)
  }

  private fun failure(detail: String): Result<Int> =
    Result.failure(EngineStartException(EngineStartError.START_FAILED, detail))

  companion object {
    const val TAG = "PhoneCanDoServeService"
    const val ACTION_START = "com.phonecando.runner.START_ENGINE"
    const val ACTION_HOLD = "com.phonecando.runner.HOLD_FOR_JOBS"

    // A time-limit stop's reason on the engines' statuses (onTimeout), like
    // the memory guard's MemoryRules.STOPPED_REASON.
    const val TIME_LIMIT_REASON = "time_limit: Android ended our time in the background"
    const val EXTRA_AGENT_ID = "agentId"
    const val EXTRA_REQUEST_ID = "requestId"
    const val EXTRA_REQUESTED_AT = "requestedAtElapsed"
    private const val MAX_REQUEST_AGE_MS = 10 * 60_000L

    // How long the service stays once nothing runs (stopIfIdle).
    private const val LINGER_MS = 10_000L

    // The runner's own prefs file: the launch target waiting for the app
    // (notify/LaunchTargets), the notification-permission ask, the
    // self-update mark, the accessibility-connected flag, the user's run
    // limits (limits/RunLimitStore). Engine state lives in agents.json.
    const val PREFS = "phonecando-engine"
  }
}
