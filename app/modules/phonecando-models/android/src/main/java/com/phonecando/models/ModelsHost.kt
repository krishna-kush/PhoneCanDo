package com.phonecando.models

import android.content.Context
import com.phonecando.lme.api.http.UrlConnectionPort
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.HubCallsLeft
import com.phonecando.lme.store.ModelStore
import com.phonecando.lme.store.layout.ModelLayout
import com.phonecando.models.catalog.CatalogOps
import com.phonecando.models.device.DeviceReader
import com.phonecando.models.device.NetworkState
import com.phonecando.models.errors.ModelErrorCode
import com.phonecando.models.jobs.DownloadOps
import com.phonecando.models.jobs.ImportOps
import com.phonecando.models.jobs.JobReporter
import com.phonecando.models.jobs.ModelJob
import com.phonecando.models.jobs.ModelJobs
import com.phonecando.models.jobs.ResumeList
import com.phonecando.models.serving.ServingSource
import com.phonecando.models.store.ModelPaths
import com.phonecando.models.token.HfTokenVault
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The local models' Android host, one per process: the one ModelStore over
 * `files/models/` (swept once, before any job), the phone as lme sees it,
 * the Hugging Face token, the running jobs and our own executor (a download
 * takes minutes; Expo's async queue is one thread shared by every module).
 * It outlives a JS reload, so jobs keep running, and its creation resumes
 * the downloads the last process was running. The runner's model servers
 * read the store and the device through it and say which models they serve
 * ([serving]); the runner's service stays in the foreground while [jobs]
 * run. Events go to whichever module instances listen.
 */
class ModelsHost private constructor(context: Context) {
  interface Listener {
    /** A `phonecandoModelsProgress` event (JobReporter). */
    fun onProgress(event: Map<String, Any?>)

    /** Models or downloads changed: re-read them. */
    fun onChanged()
  }

  private val listeners = CopyOnWriteArrayList<Listener>()
  private val app: Context = context.applicationContext ?: context
  private val http = UrlConnectionPort()

  val device = DeviceReader(app)
  val store = ModelStore(ModelLayout(ModelPaths.models(app.filesDir)), http)
  val tokens = HfTokenVault(ModelPaths.token(app.filesDir))
  val network = NetworkState(app)
  val resumeList = ResumeList(ModelPaths.resumeList(app.filesDir))
  val jobs = ModelJobs()
  val executor: ExecutorService = Executors.newCachedThreadPool { task ->
    Thread(task, "phonecando-models").apply { isDaemon = true }
  }

  /** The models the runner's model servers serve now (it sets this when it starts). */
  @Volatile
  var serving: ServingSource = ServingSource.NONE

  val catalog = CatalogOps(this)
  val downloads = DownloadOps(this)
  val imports = ImportOps(this, app.contentResolver)

  init {
    // What an import killed mid-copy left: before any job can run. Then the
    // downloads the last process left running carry on.
    try {
      store.sweep()
      downloads.resumeInterrupted()
    } catch (_: Exception) {
      // A registry we cannot read fails every call that needs it instead.
    }
  }

  /** What the Hub's last answer said is left of its API calls, kept across every [hub]. */
  private val callsLeft = HubCallsLeft()

  /** The Hub, with the user's token when one is kept. */
  fun hub(): HfCatalog = HfCatalog(http, tokens.read(), callsLeft)

  fun addListener(listener: Listener) = listeners.addIfAbsent(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  fun changed() = listeners.forEach { it.onChanged() }

  /**
   * Runs [job] (already registered with [jobs]) on our executor: the job
   * ends (its target is free again), the records' change goes out, then
   * the last progress event, so a listener that reacts to it reads the
   * final records.
   */
  fun run(job: ModelJob, body: (JobReporter) -> Unit) {
    val reporter = JobReporter(job, { event -> listeners.forEach { it.onProgress(event) } }, jobs::progressed)
    executor.execute {
      var error: Throwable? = null
      try {
        reporter.start()
        body(reporter)
      } catch (e: Throwable) {
        error = e
      } finally {
        jobs.end(job)
        changed()
        reporter.finish(error?.let(ModelErrorCode::messageOf), error?.let { ModelErrorCode.of(it).code })
      }
    }
  }

  companion object {
    @Volatile
    private var instance: ModelsHost? = null

    fun get(context: Context): ModelsHost =
      instance ?: synchronized(this) { instance ?: ModelsHost(context).also { instance = it } }

    /** The host if anything created it yet (no job can run before that). */
    fun peek(): ModelsHost? = instance
  }
}
