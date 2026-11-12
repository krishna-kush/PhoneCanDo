package com.phonecando.linux.envs

import com.phonecando.linux.LinuxHost
import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.host.LinuxGate
import com.phonecando.linux.ids.ShortIds
import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.linux.records.EnvRecord
import com.phonecando.linux.records.EnvSource
import com.phonecando.linux.records.EnvState
import com.phonecando.linux.records.RecordFile
import com.phonecando.linux.registry.EnvBase
import com.phonecando.linux.registry.RegistryRef
import com.phonecando.lre.api.LreException
import com.phonecando.lre.image.delete.ImageDelete
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.registry.ResolvedImage
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.retry.RetryLoop
import com.phonecando.network.retry.RetryPolicy

/**
 * Envs: the Default env (the APK's image), the Android env (no Linux) and
 * registry envs, whose layers we download once, keep compressed and
 * verified, and never modify.
 *
 * A registry env's download runs as one job: a dropped connection, a server
 * error or a rate limit waits and goes on where it stopped by itself, and
 * with no network it waits for one (RetryLoop). One the process or a long
 * outage stopped runs again on the next start (the host's resume list,
 * [resumeInterrupted]).
 */
class EnvOps(private val host: LinuxHost) {
  private val records get() = host.records
  private val paths get() = host.paths
  private val retries = RetryLoop(online = host.android.network::online)

  fun list(): List<EnvRecord> = records.envs()

  /** Idempotent. The record follows the image in this APK (an update may bring a new version). */
  fun ensureDefault(): EnvRecord {
    val info = host.defaultImage.info()
    LinuxGate.requireDefaultImage(host.android.status(), info != null && host.defaultImage.isPresent())
    val version = info!!.version
    return records.transact {
      val current = env(DEFAULT_ID)
      val next = current?.copy(source = EnvSource.Default(version))
        ?: EnvRecord(DEFAULT_ID, "Default", EnvSource.Default(version), EnvState.READY, null, 0, now(), null, null)
      putEnv(next)
      next
    }
  }

  /** Idempotent; works on every channel. */
  fun ensureAndroid(): EnvRecord = records.transact {
    env(ANDROID_ID) ?: EnvRecord(ANDROID_ID, "Android", EnvSource.Android, EnvState.READY, null, 0, now(), null, null)
      .also(::putEnv)
  }

  /** Starts the download of [image]:[tag]; the env is `downloading` until the job ends. */
  fun createRegistry(image: String, tag: String): Pair<Job, EnvRecord> {
    LinuxGate.requireLinux(host.android.status())
    val ref = RegistryRef.parse(image, tag)
    val (job, env) = host.transactWithJob { begin ->
      val id = ShortIds.next(envs.map { it.id }.toSet() + dirNames())
      val job = begin(JobTarget.env(id))
      val env = EnvRecord(
        id = id,
        name = RegistryRef.displayName(image, tag),
        source = EnvSource.Registry(image.trim(), tag.trim(), ""),
        state = EnvState.DOWNLOADING,
        os = null,
        sizeBytes = 0,
        createdAt = now(),
        error = null,
        errorCode = null,
      )
      putEnv(env)
      job to env
    }
    runDownload(job, env.id, ref)
    return job to env
  }

  /** Downloads a registry env again, resuming partial layers and re-verifying finished ones. */
  fun retry(envId: String): Job {
    val env = records.env(envId) ?: throw LreException.NotFound("env $envId")
    val source = env.source as? EnvSource.Registry
      ?: throw LinuxError(LinuxErrorCode.NOT_FOUND, "nothing to retry: only a registry env downloads")
    LinuxGate.requireLinux(host.android.status())
    val ref = RegistryRef.parse(source.image, source.tag).let { if (source.digest.isEmpty()) it else it.withDigest(source.digest) }
    val job = host.transactWithJob { begin ->
      val job = begin(JobTarget.env(envId))
      updateEnv(envId) { it.copy(state = EnvState.DOWNLOADING, error = null, errorCode = null) }
        ?: throw LreException.NotFound("env $envId")
      job
    }
    runDownload(job, envId, ref)
    return job
  }

  /**
   * Removes the env and its blobs (trash, then a background delete).
   * Idempotent. @throws LinuxError env_in_use while an image was made from it.
   */
  fun delete(envId: String) {
    requireUnused(envId)
    host.jobs.cancelAndAwait(JobTarget.env(envId), CANCEL_WAIT_MS)
    val removed = records.transact {
      val env = env(envId) ?: return@transact null
      if (images.any { it.envId == envId }) throw inUse(envId)
      // A retry may have started since the cancel; its files would outlive the env.
      if (host.jobs.isLive(JobTarget.env(envId))) throw LinuxError(LinuxErrorCode.BUSY, "env $envId is downloading again")
      removeEnv(envId)
      env
    } ?: return
    host.envResumes.remove(envId)
    if (removed.source is EnvSource.Registry) ImageDelete().delete(paths.envAsLayout(envId), host.executor)
  }

  private fun requireUnused(envId: String) {
    if (records.images().any { it.envId == envId }) throw inUse(envId)
  }

  private fun inUse(envId: String) =
    LinuxError(LinuxErrorCode.ENV_IN_USE, "env $envId has images; delete them first (a reset needs the env's base)")

  /**
   * Runs, once per process, env download [envId] the last process left on the
   * resume list (Recovery); one that cannot start fails like any download.
   */
  fun resumeInterrupted(envId: String) {
    try {
      retry(envId)
    } catch (e: Exception) {
      host.envResumes.remove(envId)
      try {
        failed(envId, e)
      } catch (_: Exception) {
        // Recording it failed (disk); the record says downloading until the next start.
      }
    }
  }

  private fun runDownload(job: Job, envId: String, ref: ImageRef) {
    host.envResumes.add(envId)
    host.run(job, onError = { e -> failed(envId, e) }) { reporter ->
      try {
        retries.run(reporter, job.cancel) { download(job, envId, ref, reporter) }
        host.envResumes.remove(envId)
      } catch (e: Throwable) {
        // It stays on the list only for what a later start can fix: a network that stayed down.
        if (!RetryPolicy.retryable(e)) host.envResumes.remove(envId)
        throw e
      }
    }
  }

  /** Resolve once (saved as base.json, pinning the digest), then every layer into blobs/. */
  private fun download(job: Job, envId: String, ref: ImageRef, sink: ProgressSink) {
    val resolved = savedBase(envId) ?: resolve(job, envId, ref, sink)
    val total = resolved.downloadSize
    var before = 0L
    for (layer in resolved.layers) {
      host.registry.fetchBlob(
        resolved,
        layer,
        paths.envBlobs(envId),
        { p -> sink.report(Progress(p.step, before + p.done, total)) },
        job.cancel,
      )
      before += layer.size
    }
    records.transact {
      updateEnv(envId) { it.copy(state = EnvState.READY, sizeBytes = total, error = null, errorCode = null) }
    }
  }

  private fun resolve(job: Job, envId: String, ref: ImageRef, sink: ProgressSink): ResolvedImage {
    sink.report(Progress(STEP_RESOLVE, 0, null))
    val resolved = host.registry.resolve(ref, job.cancel)
    RecordFile(paths.envBase(envId)).write(EnvBase.encode(resolved))
    records.transact {
      updateEnv(envId) { env ->
        val source = env.source as? EnvSource.Registry ?: return@updateEnv env
        env.copy(source = source.copy(digest = resolved.manifestDigest))
      }
    }
    return resolved
  }

  private fun savedBase(envId: String): ResolvedImage? {
    val file = paths.envBase(envId)
    return if (file.isFile) EnvBase.decode(file.readText(Charsets.UTF_8)) else null
  }

  private fun failed(envId: String, e: Throwable) {
    records.transact {
      updateEnv(envId) {
        it.copy(state = EnvState.FAILED, error = LinuxErrorCode.lineOf(e), errorCode = LinuxErrorCode.of(e).code)
      }
    }
  }

  // An orphan dir (records lost) still blocks its id.
  private fun dirNames(): Set<String> = paths.envs.list()?.toSet().orEmpty()

  private fun now() = System.currentTimeMillis()

  companion object {
    const val DEFAULT_ID = "default"
    const val ANDROID_ID = "android"
    const val STEP_RESOLVE = "resolve"
    const val CANCEL_WAIT_MS = 15_000L
  }
}
