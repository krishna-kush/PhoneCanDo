package com.phonecando.runner.models

import android.content.Context
import android.content.Intent
import android.util.Log
import com.phonecando.models.ModelsHost
import com.phonecando.runner.PhoneCanDoServeService
import java.util.concurrent.atomic.AtomicBoolean

// Keeps the app's process alive while a model download or import runs: the
// first job starts our foreground service (ACTION_HOLD), which lists the
// jobs in its one notification and stops itself once neither an engine nor
// a job runs. A model is gigabytes, and Android ends a background app's
// process long before such a download is done. A job begins from a tap in
// the app, so the service may start; if Android refuses anyway, the job
// still runs while the process lives and resumes later from its .part.
internal object ModelJobsAnchor {
  private val installed = AtomicBoolean(false)
  private val holding = AtomicBoolean(false)

  /** Once per process (the runner module's create); idempotent. */
  fun install(context: Context) {
    if (!installed.compareAndSet(false, true)) return
    val app = context.applicationContext ?: context
    val jobs = ModelsHost.get(app).jobs
    jobs.addListener {
      if (!jobs.anyRunning()) {
        holding.set(false)
      } else if (holding.compareAndSet(false, true)) {
        hold(app)
      }
    }
  }

  private fun hold(context: Context) {
    try {
      context.startForegroundService(
        Intent(context, PhoneCanDoServeService::class.java).setAction(PhoneCanDoServeService.ACTION_HOLD),
      )
    } catch (e: Exception) {
      holding.set(false)
      Log.w("PhoneCanDoModels", "foreground service refused for a model job (${e.javaClass.simpleName})")
    }
  }
}
