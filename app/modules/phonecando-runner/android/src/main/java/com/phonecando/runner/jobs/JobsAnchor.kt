package com.phonecando.runner.jobs

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.phonecando.linux.LinuxHost
import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobReporter
import com.phonecando.models.ModelsHost
import com.phonecando.models.jobs.ModelJob
import com.phonecando.runner.PhoneCanDoServeService
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

// Keeps the app's process alive while a model job (download, import) or a
// Linux job (env download, machine setup, agent install) runs: when one
// runs and our foreground service is down, it starts the service
// (ACTION_HOLD), which lists the jobs in its one notification and stops
// itself once neither an engine nor a job runs. A model is gigabytes, a
// Linux system hundreds of megabytes, and Android freezes a background
// app's process seconds after it leaves the screen. The service says when
// it starts and ends, so a service gone while jobs still run is asked for
// again (HoldRule). A job begins from a tap in the app, so the service may
// start; if Android refuses anyway, the job still runs while the process
// lives and resumes later where it stopped.
internal object JobsAnchor {
  /** The jobs began, ended or moved on (Linux jobs at most every [TICK_MS]). */
  fun interface Listener {
    fun onJobs()
  }

  private val installed = AtomicBoolean(false)
  private val listeners = CopyOnWriteArrayList<Listener>()
  private val lock = Any()
  private var state = HoldRule.State()
  private var serviceUp = false
  private var lastLinuxTick = 0L

  @Volatile
  private var models: ModelsHost? = null

  @Volatile
  private var linux: LinuxHost? = null

  /** Once per process (the runner module's create, the service's); idempotent. */
  fun install(context: Context) {
    if (!installed.compareAndSet(false, true)) return
    val app = context.applicationContext ?: context
    val modelsHost = ModelsHost.get(app).also { models = it }
    val linuxHost = LinuxHost.get(app).also { linux = it }
    modelsHost.jobs.addListener { changed(app) }
    linuxHost.addListener(object : LinuxHost.Listener {
      override fun onProgress(event: Map<String, Any?>) {
        if (linuxTick(event)) changed(app)
      }

      override fun onChanged() {}
    })
  }

  fun addListener(listener: Listener) = listeners.addIfAbsent(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  fun anyRunning(): Boolean = models?.jobs?.anyRunning() == true || linux?.jobs?.anyRunning() == true

  fun modelJobs(): List<ModelJob> = models?.jobs?.running().orEmpty()

  fun linuxJobs(): List<Job> = linux?.jobs?.running().orEmpty()

  /** An env record's name, for the notification's Linux lines. */
  fun envName(envId: String): String? = linux?.records?.env(envId)?.name

  /** The service is up ([up]) or gone: a service gone while jobs run is asked for again on the next job event. */
  fun service(up: Boolean) {
    synchronized(lock) {
      serviceUp = up
      state = HoldRule.serviceChanged(state)
    }
  }

  private fun changed(context: Context) {
    val running = modelJobs().map { "model:${it.id}" } + linuxJobs().map { "linux:${it.id}" }
    val ask = synchronized(lock) {
      val step = HoldRule.onJobs(state, running.toSet(), serviceUp)
      state = step.state
      step.ask
    }
    if (ask) hold(context)
    listeners.forEach { it.onJobs() }
  }

  // A job's start and end at once; its progress at most every TICK_MS.
  private fun linuxTick(event: Map<String, Any?>): Boolean {
    val now = SystemClock.elapsedRealtime()
    val edge = event["finished"] == true || event["step"] == JobReporter.START
    synchronized(lock) {
      if (!edge && now - lastLinuxTick < TICK_MS) return false
      lastLinuxTick = now
    }
    return true
  }

  private fun hold(context: Context) {
    try {
      context.startForegroundService(
        Intent(context, PhoneCanDoServeService::class.java).setAction(PhoneCanDoServeService.ACTION_HOLD),
      )
    } catch (e: Exception) {
      synchronized(lock) { state = HoldRule.refused(state) }
      Log.w(TAG, "foreground service refused for a job (${e.javaClass.simpleName})")
    }
  }

  private const val TAG = "PhoneCanDoJobs"

  // As often as the model jobs tell (ModelJobs' tick).
  private const val TICK_MS = 2_000L
}
