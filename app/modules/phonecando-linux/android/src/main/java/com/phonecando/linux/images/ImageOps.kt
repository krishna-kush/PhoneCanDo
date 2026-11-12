package com.phonecando.linux.images

import com.phonecando.agents.kit.ProjectDir
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
import com.phonecando.linux.records.ImageRecord
import com.phonecando.linux.records.ImageState
import com.phonecando.linux.terminal.TerminalRecipe
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.ImageSetup
import com.phonecando.lre.image.conf.SocketBudget
import com.phonecando.lre.image.delete.ImageDelete
import com.phonecando.lre.image.reset.ImageReset
import com.phonecando.lre.image.reset.ReinstallList
import com.phonecando.lre.image.tools.MissingTools
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink

/**
 * Images: made from an env (create, resumable), reset to a fresh copy of
 * the env's base (home/ kept), deleted, and prepared before every engine
 * start or terminal. The caller stops the image's engine before a reset or
 * delete.
 */
class ImageOps(private val host: LinuxHost) {
  private val records get() = host.records
  private val paths get() = host.paths

  fun list(): List<ImageRecord> = records.images()

  /** Starts making an image from [envId]; the image is `creating` until the job ends. */
  fun create(envId: String): Pair<Job, ImageRecord> {
    val env = usableEnv(envId)
    val hostEnv = host.android.hostEnv()
    val (job, image) = host.transactWithJob { begin ->
      val current = env(envId)
      if (current?.state != EnvState.READY) throw envNotReady(envId)
      val taken = images.map { it.id }.toSet() + dirNames()
      val id = ShortIds.next(taken) { !SocketBudget.isTight(paths.image(it), hostEnv) }
      val job = begin(JobTarget.image(id))
      val image = ImageRecord(id, envId, ImageState.CREATING, null, null, null, null, 0, now())
      putImage(image)
      job to image
    }
    runCreate(job, image.id, env)
    return job to image
  }

  /** Runs setup again: a failed create resumes at the step that failed; a ready image is checked and re-measured. */
  fun retry(imageId: String): Job {
    val env = usableEnv(image(imageId).envId)
    val job = host.transactWithJob { begin ->
      val image = image(imageId) ?: throw LreException.NotFound("image $imageId")
      if (image.state != ImageState.FAILED && image.state != ImageState.READY) throw busy(image)
      val job = begin(JobTarget.image(imageId))
      putImage(image.copy(state = ImageState.CREATING, failedStep = null, error = null, errorCode = null))
      job
    }
    runCreate(job, imageId, env)
    return job
  }

  /**
   * Resets a ready Linux image to a fresh copy of its env's base. The image
   * stays as it was when the reset fails (it goes back to `ready` with the
   * error noted).
   */
  fun reset(imageId: String): Job {
    val env = usableEnv(image(imageId).envId)
    if (!env.isLinux) throw LinuxError(LinuxErrorCode.NOT_FOUND, "an Android image has no Linux system to reset")
    val job = host.transactWithJob { begin ->
      val image = image(imageId) ?: throw LreException.NotFound("image $imageId")
      if (image.state != ImageState.READY) throw busy(image)
      val job = begin(JobTarget.image(imageId))
      putImage(image.copy(state = ImageState.RESETTING, failedStep = null, error = null, errorCode = null))
      job
    }
    host.run(job, onError = { e -> resetFailed(imageId, e) }) { sink ->
      host.imageLocks.with(imageId) {
        val layout = paths.image(imageId)
        val hostEnv = host.android.hostEnv()
        // Background servers or terminal daemons must not run on while the system is swapped.
        ImageReaper().stopAll(layout.root.path)
        // Shims follow the APK's lib dir, which moves on update: the package query runs through them.
        ImageSetup.refreshForStart(layout, hostEnv)
        val base = host.bases.of(env)
        val result = ImageReset(GuestProcessRunner(), LayerProgressUnpacker(base))
          .reset(layout, base, hostEnv, host.android.freeBytes(), sink, job.cancel)
        finish(imageId, env.id, result.os, sink)
      }
    }
    return job
  }

  /**
   * Cancels any job on the image, moves it to the trash and deletes it in
   * the background. Idempotent. The move waits for a start being prepared.
   */
  fun delete(imageId: String) {
    host.jobs.cancelAndAwait(JobTarget.image(imageId), CANCEL_WAIT_MS)
    host.imageLocks.with(imageId) {
      val marked = records.transact { updateImage(imageId) { it.copy(state = ImageState.DELETING) } }
      if (marked != null) {
        ImageReaper().stopAll(paths.image(imageId).root.path)
        ImageDelete().delete(paths.image(imageId), host.executor)
        records.transact { removeImage(imageId) }
      }
    }
  }

  /** Bytes the image takes (system + home), and the record updated to it. */
  fun size(imageId: String): Long {
    image(imageId)
    val bytes = DirSize.of(paths.image(imageId).root)
    records.transact { updateImage(imageId) { if (it.sizeBytes == bytes) it else it.copy(sizeBytes = bytes) } }
    return bytes
  }

  /**
   * Before every engine start and terminal: rewrites what depends on the
   * phone (DNS, shims, launch.conf, engine.env, fake /proc) and finishes a
   * reset a kill cut short. Cheap when nothing changed, but it scans the
   * guest's bin dirs, so it runs on our executor. A start that races a
   * create or reset waits for the lock, then sees the job's state; a guest
   * script running on the image does not hold it up.
   *
   * [guestUnset]: the variables (a trailing `*` for a prefix) the image's
   * agent holds as secrets; launch.conf unsets them and `LD_*` for every
   * guest command until the next prepare.
   */
  fun prepareForStart(imageId: String, guestUnset: List<String>) {
    startable(imageId)
    host.imageLocks.with(imageId) {
      startable(imageId)
      ImageSetup.refreshForStart(paths.image(imageId), host.android.hostEnv(), guestUnset)
    }
  }

  /**
   * Which of [commands] (an agent's tools) the image's guest PATH lacks, and
   * the line that installs them; nothing for an image with no Linux. Cheap
   * file checks, no lock: a job may be installing meanwhile.
   */
  fun checkTools(imageId: String, commands: List<String>): MissingTools {
    val image = image(imageId)
    if (image.state != ImageState.READY) throw busy(image)
    return ImageSetup.checkTools(paths.image(imageId), commands)
  }

  /**
   * A login shell in the image for our PTY, in the work folder in its
   * home/ (ProjectDir), made here as an engine start makes it. Cheap: the
   * caller ran [prepareForStart] first.
   */
  fun terminalRecipe(imageId: String): TerminalRecipe {
    val layout = paths.image(imageId)
    ProjectDir.of(layout.home).mkdirs()
    return if (startable(imageId)) TerminalRecipe.linux(layout) else TerminalRecipe.android(layout)
  }

  fun reinstallList(imageId: String): ReinstallList? = ReinstallList.read(paths.image(image(imageId).id))

  /** Forgets the reinstall offer once the user reinstalled or dismissed it. */
  fun clearReinstallList(imageId: String) = ReinstallList.clear(paths.image(image(imageId).id))

  private fun runCreate(job: Job, imageId: String, env: EnvRecord) {
    // Same thread for body and onError (LinuxHost.run), so a plain local is enough.
    var steps: SetupStepTracker? = null
    host.run(job, onError = { e -> createFailed(imageId, steps?.step, e) }) { sink ->
      host.imageLocks.with(imageId) {
        val tracker = SetupStepTracker(sink).also { steps = it }
        val layout = paths.image(imageId)
        val hostEnv = host.android.hostEnv()
        val result = if (env.isLinux) {
          val base = host.bases.of(env)
          ImageSetup(LayerProgressUnpacker(base)).create(layout, base, hostEnv, host.android.freeBytes(), tracker, job.cancel)
        } else {
          ImageSetup.android(layout, hostEnv)
        }
        finish(imageId, env.id, result.os, sink)
      }
    }
  }

  /**
   * Measures the image and records it ready with the [os] the create or
   * reset found; the env learns its OS from its first image.
   */
  private fun finish(imageId: String, envId: String, os: OsInfo?, sink: ProgressSink) {
    sink.report(Progress(STEP_MEASURE, 0, null))
    val bytes = DirSize.of(paths.image(imageId).root)
    records.transact {
      updateImage(imageId) {
        it.copy(
          state = ImageState.READY,
          failedStep = null,
          error = null,
          errorCode = null,
          os = os,
          sizeBytes = bytes,
        )
      }
      if (os != null) updateEnv(envId) { if (it.os == null) it.copy(os = os) else it }
    }
  }

  private fun createFailed(imageId: String, step: String?, e: Throwable) {
    records.transact {
      updateImage(imageId) {
        it.copy(state = ImageState.FAILED, failedStep = step, error = LinuxErrorCode.lineOf(e), errorCode = LinuxErrorCode.of(e).code)
      }
    }
  }

  private fun resetFailed(imageId: String, e: Throwable) {
    records.transact {
      updateImage(imageId) {
        it.copy(state = ImageState.READY, error = LinuxErrorCode.lineOf(e), errorCode = LinuxErrorCode.of(e).code)
      }
    }
  }

  /** The env an image is (or will be) made from, ready and allowed on this build. */
  private fun usableEnv(envId: String): EnvRecord {
    val env = records.env(envId) ?: throw LreException.NotFound("env $envId")
    if (env.state != EnvState.READY) throw envNotReady(envId)
    when (env.source) {
      is EnvSource.Default -> LinuxGate.requireDefaultImage(host.android.status(), host.defaultImage.isPresent())
      is EnvSource.Registry -> LinuxGate.requireLinux(host.android.status())
      EnvSource.Android -> Unit
    }
    return env
  }

  private fun envNotReady(envId: String): LinuxError {
    val env = records.env(envId)
    return if (env?.state == EnvState.DOWNLOADING) {
      LinuxError(LinuxErrorCode.BUSY, "env $envId is still downloading")
    } else {
      LinuxError(LinuxErrorCode.NOT_FOUND, "env $envId is not ready; retry its download")
    }
  }

  internal fun image(imageId: String): ImageRecord = records.image(imageId) ?: throw LreException.NotFound("image $imageId")

  /**
   * Whether an engine, a terminal or a guest command can start on the
   * image: ready, no create or reset on it (a guest script leaves it
   * usable), and Linux allowed on this build when it has Linux. True for a
   * Linux image, false for an Android one.
   */
  internal fun startable(imageId: String): Boolean {
    val image = image(imageId)
    if (image.state == ImageState.FAILED) {
      throw LinuxError(LinuxErrorCode.NOT_FOUND, "image $imageId is not set up; retry it")
    }
    val job = host.jobs.live(JobTarget.image(imageId))
    if (image.state != ImageState.READY || (job != null && !job.guestScript)) throw busy(image)
    val linux = isLinux(image)
    if (linux) LinuxGate.requireLinux(host.android.status())
    return linux
  }

  internal fun busy(image: ImageRecord) = LinuxError(LinuxErrorCode.BUSY, "image ${image.id} is ${image.state.id}")

  // Linux unless its env is Android; with the env gone, whether it has a system.
  private fun isLinux(image: ImageRecord): Boolean =
    records.env(image.envId)?.isLinux ?: paths.image(image.id).rootfs.exists()

  private fun dirNames(): Set<String> = paths.images.list()?.toSet().orEmpty()

  private fun now() = System.currentTimeMillis()

  private companion object {
    const val STEP_MEASURE = "measure"
    const val CANCEL_WAIT_MS = 15_000L
  }
}
