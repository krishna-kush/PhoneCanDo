package com.phonecando.runner

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.text.format.DateFormat
import android.util.Log
import com.phonecando.models.jobs.JobTarget
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.fanout.CheckFanOut
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.cutoff.CutOffLook
import com.phonecando.runner.cutoff.CutOffs
import com.phonecando.runner.cutoff.Held
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineRequests
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.work.WorkWatch
import com.phonecando.runner.jobs.JobsAnchor
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.notify.AppForeground
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.notify.LinuxJobLines
import com.phonecando.runner.notify.ReadingLines
import com.phonecando.runner.notify.ServiceNotification
import com.phonecando.runner.notify.TimeLimitNotice
import com.phonecando.runner.notify.TransferLines
import com.phonecando.runner.notify.WorkLines
import com.phonecando.runner.power.WorkLock
import java.util.Date
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
// one notification listing the running agents' chats, the agents kept up
// by what they left running (with Stop: ACTION_STOP_JOB for one job,
// ACTION_STOP_AGENT for the agent with all of it), the engines
// starting, the model server reading a prompt and the jobs (with none of
// that, the agents ready), keeps the CPU awake while any of that works
// (power/WorkLock), and stops itself once nothing has run for 10 s
// (stopIfIdle).
// It is in the foreground while anything of ours runs, idle engines too
// (render). Out of the foreground with the app away, Android stops a plain
// service about a minute later, and the engines with it (onDestroy),
// before the work watch's idle stop would; and away, it lets the service
// back into the foreground only in an exemption's window (an alarm's), so
// a run that a message wakes later would get none (seen on the phone).
// How long an agent runs is the idle stop's and Keep running's call
// (engine/work/), never this service's.
// Nothing restarts it: every command answers START_NOT_STICKY, and a
// null-intent restart starts nothing (the app ensures its engines again
// when it comes to the foreground).
class PhoneCanDoServeService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private lateinit var starts: ExecutorService
  private lateinit var notification: ServiceNotification
  private lateinit var workLock: WorkLock

  // Main thread only. A stop is stopSelf(lastStartId): a newer
  // startForegroundService() may already be queued, and stopping under it
  // crashes the app (ForegroundServiceDidNotStartInTimeException); with the
  // id the system ignores the stop and that start decides instead.
  private var lastStartId = 0
  private val pendingRequests = LinkedHashSet<String>()

  // Main thread only: the agents whose start runs, one entry per start.
  private val starting = ArrayList<String>()

  // Main thread only: the jobs a Stop from the notification ends now (root
  // pid → name), each a "Stopping …" line, and those it ended, kept off
  // their agent's line until a look no longer finds them.
  private val endingJobs = LinkedHashMap<Int, String>()
  private val endedJobs = HashSet<Int>()

  // Main thread only: what the last Stop from the notification ended
  // ("opencode stopped"): the notification says so in place of its last
  // lines while the service lingers with nothing left running. A start,
  // anything to list or leaving the foreground clears it.
  private var ended: String? = null
  private var doneShown: String? = null

  // Main thread only: startForeground took, and nothing left the foreground since.
  private var foreground = false

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

    // Every look renews the wake lock; a change also redraws.
    override fun onWork(changed: Boolean) {
      main.post { if (changed) render() else holdCpu() }
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
    // Before any engine starts: the capability checks hear every launch.
    Checks.init(this)
    CheckFanOut.install(this)
    // Before any engine starts: the record of runs going hears every one,
    // and offers what an earlier process left cut off (cutoff/).
    CutOffs.get(this).look(CutOffLook.Trigger.START)
    notification = ServiceNotification(this).also { it.createChannel() }
    workLock = WorkLock(this)
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
    when (intent?.action) {
      ACTION_START -> {
        val agentId = intent.getStringExtra(EXTRA_AGENT_ID)
        val requestId = intent.getStringExtra(EXTRA_REQUEST_ID)
        val mode = EngineMode.of(intent.getStringExtra(EXTRA_MODE))
        when {
          agentId.isNullOrEmpty() -> EngineRequests.complete(requestId, failure("no agent given"))
          mode == null -> EngineRequests.complete(requestId, failure("no such mode"))
          else -> runStart(agentId, requestId, requestedAt(intent), mode)
        }
      }
      ACTION_STOP_AGENT -> intent.getStringExtra(EXTRA_AGENT_ID)?.takeIf { it.isNotEmpty() }?.let(::runStop)
      ACTION_STOP_JOB -> runStopJob(intent)
    }
    // Every startForegroundService() wants a startForeground() back, also
    // with nothing running: render then leaves the foreground again. A
    // Stop from the notification comes by startService and wants none.
    if (intent?.action != ACTION_STOP_AGENT && intent?.action != ACTION_STOP_JOB) goForeground()
    // ACTION_HOLD (a job runs), a null-intent restart or nothing to
    // do: start nothing; stay while an engine or a job runs.
    render()
    stopIfIdle()
    return START_NOT_STICKY
  }

  private fun runStart(agentId: String, requestId: String?, requestedAt: Long, mode: EngineMode) {
    ended = null
    starting += agentId
    requestId?.let(pendingRequests::add)
    val supervisor = Engines.get(this)
    // Who asked with no promise to wait on (a message, a task) hears how it went.
    Engines.startTaken(agentId)
    try {
      starts.execute {
        val result = runCatching { supervisor.start(agentId, requestedAt, mode) }
        EngineRequests.complete(requestId, result)
        result.exceptionOrNull()?.let { Engines.startFailed(agentId, it.message ?: "it did not start") }
        main.post {
          starting.remove(agentId)
          requestId?.let(pendingRequests::remove)
          render()
          stopIfIdle()
        }
      }
    } catch (_: RejectedExecutionException) {
      starting.remove(agentId)
      requestId?.let(pendingRequests::remove)
      EngineRequests.complete(requestId, failure("the engine service is stopping"))
      Engines.startFailed(agentId, "the engine service is stopping")
    }
  }

  // The notification's Stop on an agent kept up: it and its jobs end, on
  // their own thread (up to 3 s); the engine's status tells the app.
  private fun runStop(agentId: String) {
    Log.i(TAG, "stop from the notification: $agentId")
    val name = AgentStores.get(this).get(agentId)?.name ?: agentId
    Thread({
      Engines.get(this).stop(agentId)
      main.post {
        ended = "$name stopped"
        render()
      }
    }, "phonecando-engine-stop").apply {
      isDaemon = true
      start()
    }
  }

  // The notification's Stop on one job: it and what is under it end on
  // their own thread (up to 3 s, JobEnd), the agent and its other jobs
  // stay; "Stopping …" until then, "… stopped" after.
  private fun runStopJob(intent: Intent) {
    val agentId = intent.getStringExtra(EXTRA_AGENT_ID)?.takeIf { it.isNotEmpty() } ?: return
    val pid = intent.getIntExtra(EXTRA_JOB_PID, 0).takeIf { it > 0 } ?: return
    val job = WorkWatch.Job(intent.getStringExtra(EXTRA_JOB_NAME) ?: "the job", pid, intent.getLongExtra(EXTRA_JOB_START, 0L))
    val watch = Engines.work() ?: return
    if (pid in endingJobs) return
    endingJobs[pid] = job.name
    render()
    Thread({
      watch.stopJob(agentId, job)
      main.post {
        endingJobs.remove(pid)
        endedJobs += pid
        ended = "${job.name} stopped"
        render()
      }
    }, "phonecando-job-stop").apply {
      isDaemon = true
      start()
    }
  }

  private fun stopIntent(agentId: String): PendingIntent = PendingIntent.getService(
    this,
    agentId.hashCode(),
    Intent(this, PhoneCanDoServeService::class.java).setAction(ACTION_STOP_AGENT).putExtra(EXTRA_AGENT_ID, agentId),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun stopJobIntent(agentId: String, job: WorkWatch.Job): PendingIntent = PendingIntent.getService(
    this,
    "$agentId/${job.pid}".hashCode(),
    Intent(this, PhoneCanDoServeService::class.java).setAction(ACTION_STOP_JOB)
      .putExtra(EXTRA_AGENT_ID, agentId)
      .putExtra(EXTRA_JOB_PID, job.pid)
      .putExtra(EXTRA_JOB_START, job.startTicks)
      .putExtra(EXTRA_JOB_NAME, job.name),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

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
    starting.isEmpty() && Engines.peek()?.anyLive() != true && !JobsAnchor.anyRunning()

  override fun onDestroy() {
    Engines.removeListener(engineListener)
    JobsAnchor.removeListener(jobsListener)
    workLock.release()
    // Jobs still running (the system ended the service): the next job
    // event asks for the service again.
    JobsAnchor.service(up = false)
    starts.shutdownNow()
    for (id in pendingRequests) EngineRequests.complete(id, failure("the engine service stopped"))
    pendingRequests.clear()
    main.removeCallbacksAndMessages(null)
    // Engines still running (the system ended the service): end them off
    // the main thread, which can take up to 3 s. When nothing runs, a start
    // that arrives right after must not be caught by a late stop-all. The
    // runs they had going are kept and offered back (cutoff/).
    Engines.peek()?.takeIf { it.anyLive() }?.let { engines ->
      CutOffs.peek()?.hold(Held.SYSTEM)
      engines.stopAllAsync(if (timedOut) TIME_LIMIT_REASON else null)
    }
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
    workLock.release()
    stopForeground(STOP_FOREGROUND_REMOVE)
    foreground = false
    stopSelf()
    Engines.peek()?.takeIf { it.anyLive() }?.let {
      // The runs they had going are kept and offered back (cutoff/).
      CutOffs.peek()?.hold(Held.SYSTEM)
      it.stopAllAsync(TIME_LIMIT_REASON)
      TimeLimitNotice.post(this)
    }
  }

  // Away from the app, Android refuses a later startForeground (as it
  // does a new start of this service), so a refusal is logged and what
  // runs goes on unheld.
  private fun goForeground(shown: Notification? = content()) {
    // The manifest's type below Android 14, where specialUse does not exist.
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST
    }
    try {
      startForeground(ServiceNotification.NOTIFICATION_ID, shown ?: notification.quiet(), type)
      foreground = true
    } catch (e: Exception) {
      Log.w(TAG, "startForeground refused", e)
    }
  }

  // The notification while anything of ours runs, in the foreground (an
  // idle engine too, as ready). With nothing running it goes: at once
  // with the app in front, which may bring it back any time; away, only
  // after LINGER_MS of still nothing, as stopIfIdle waits, since work
  // often follows at once (meanwhile it says how it ended, the last Stop's
  // "… stopped" or NOTHING_LEFT, never the old lines and their Stop
  // buttons).
  private fun render() {
    if (timedOut) return
    holdCpu()
    val content = content()
    if (content == null) {
      if (!foreground) return
      main.removeCallbacks(leaveWhenStillQuiet)
      if (AppForeground.isForeground(this)) {
        leaveForeground()
        return
      }
      // Lingering: how it ended in place of the last lines, whose Stop
      // buttons would stop nothing now.
      val text = ended ?: NOTHING_LEFT
      if (text != doneShown) {
        doneShown = text
        try {
          getSystemService(NotificationManager::class.java).notify(ServiceNotification.NOTIFICATION_ID, notification.done(text))
        } catch (e: Exception) {
          Log.w(TAG, "notification update failed", e)
        }
      }
      main.postDelayed(leaveWhenStillQuiet, LINGER_MS)
      return
    }
    // Something still runs (other agents ready): the lines say what is left.
    ended = null
    doneShown = null
    main.removeCallbacks(leaveWhenStillQuiet)
    if (!foreground) {
      goForeground(content)
      return
    }
    try {
      getSystemService(NotificationManager::class.java).notify(ServiceNotification.NOTIFICATION_ID, content)
    } catch (e: Exception) {
      Log.w(TAG, "notification update failed", e)
    }
  }

  private val leaveWhenStillQuiet = Runnable { if (content() == null) leaveForeground() }

  // Nothing of ours runs: the notification goes, and the service with it
  // once stopIfIdle's wait is over.
  private fun leaveForeground() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    foreground = false
    ended = null
    doneShown = null
  }

  // The CPU stays awake while an engine starts (a message's or a task's
  // start may come with the screen off), a chat works, a model server reads
  // a prompt, a job runs, an agent's job does something or a Check now runs
  // (power/WorkLock).
  private fun holdCpu() {
    if (timedOut) return
    val supervisor = Engines.peek()
    val need = JobsAnchor.anyRunning() || CheckNow.running() ||
      starting.isNotEmpty() || supervisor?.anyStarting() == true ||
      supervisor?.chats()?.any { it.state == ChatBoard.State.WORKING } == true ||
      supervisor?.promptReading() != null ||
      Engines.work()?.states()?.values?.any { it.active } == true
    workLock.hold(need)
  }

  // The chats the engines are busy with, each with its agent's name, the
  // agents kept up by their jobs, the agents starting, the prompt a model
  // server reads, the model jobs and the Linux jobs; with none of those,
  // the engines running, as ready; null when nothing runs.
  private fun content(): Notification? {
    val supervisor = Engines.peek()
    val agents = AgentStores.get(this).all()
    val names = agents.associate { it.id to it.name }
    val running = supervisor?.statuses()?.filter { it.state.live }?.map { it.agentId }.orEmpty()
    val chats = supervisor?.chats().orEmpty()
    val working = chats.filter { it.state == ChatBoard.State.WORKING }.mapTo(HashSet()) { it.agentId }
    val clock = DateFormat.getTimeFormat(this)
    // Only agents whose engine still runs: the last look may be older than
    // a stop, and its lines (with their Stop buttons) would come back.
    val live = running.toSet()
    val states = Engines.work()?.states()?.values.orEmpty().filter { it.agentId in live }
    // A job ended here stays off its line until a look no longer finds it.
    endedJobs.retainAll(states.flatMap { s -> s.refs.map { it.pid } }.toSet())
    val work = WorkLines.of(states, working, names, endingJobs.keys + endedJobs) { clock.format(Date(it)) }
    val transfers = JobsAnchor.modelJobs().map {
      TransferLines.of(it.label, it.target.kind == JobTarget.Kind.IMPORT, it.done, it.total)
    }
    val linux = LinuxJobLines.of(JobsAnchor.linuxJobs(), JobsAnchor::envName) { image ->
      agents.firstOrNull { it.imageId == image }?.name
    }
    val reading = supervisor?.promptReading()?.let { ReadingLines.of(it.modelName, it.read, it.total) }
    val starts = starting.map { names[it] ?: it }.distinct()
    // A Stop asked (here or in the app): "Stopping …" under a progress bar
    // until the engine is down.
    val stopping = supervisor?.statuses()?.filter { it.state == EngineState.STOPPING }?.map { it.agentId }.orEmpty()
    return notification.build(
      chats, names, running, transfers, reading, linux, work, starts, ::stopIntent, stopping,
      ::stopJobIntent, endingJobs.values.toList(),
    )
  }

  private fun failure(detail: String): Result<Int> =
    Result.failure(EngineStartException(EngineStartError.START_FAILED, detail))

  companion object {
    const val TAG = "PhoneCanDoServeService"
    const val ACTION_START = "com.phonecando.runner.START_ENGINE"
    const val ACTION_HOLD = "com.phonecando.runner.HOLD_FOR_JOBS"

    // The notification's Stop on an agent kept up by its jobs (EXTRA_AGENT_ID).
    const val ACTION_STOP_AGENT = "com.phonecando.runner.STOP_AGENT"

    // The notification's Stop on one job alone (EXTRA_AGENT_ID and the job's
    // root process: EXTRA_JOB_PID, EXTRA_JOB_START; EXTRA_JOB_NAME for its lines).
    const val ACTION_STOP_JOB = "com.phonecando.runner.STOP_JOB"
    const val EXTRA_JOB_PID = "jobPid"
    const val EXTRA_JOB_START = "jobStart"
    const val EXTRA_JOB_NAME = "jobName"

    // What the notification says while it lingers with nothing running and
    // no Stop of ours ended anything.
    private const val NOTHING_LEFT = "Nothing running now"

    // A time-limit stop's reason on the engines' statuses (onTimeout), like
    // the memory guard's MemoryRules.STOPPED_REASON.
    const val TIME_LIMIT_REASON = "time_limit: Android ended our time in the background"
    const val EXTRA_AGENT_ID = "agentId"
    const val EXTRA_REQUEST_ID = "requestId"
    const val EXTRA_REQUESTED_AT = "requestedAtElapsed"

    // The mode to start in (EngineMode.wire, "acp"); absent: terminal.
    const val EXTRA_MODE = "mode"
    private const val MAX_REQUEST_AGE_MS = 10 * 60_000L

    // How long the service stays once nothing runs (stopIfIdle), and in
    // the foreground with the app away (render).
    private const val LINGER_MS = 10_000L

    // The runner's own prefs file: the launch target waiting for the app
    // (notify/LaunchTargets), the notification-permission ask, the
    // self-update mark, the accessibility-connected flag, the user's run
    // limits (limits/RunLimitStore). Engine state lives in agents.json.
    const val PREFS = "phonecando-engine"
  }
}
