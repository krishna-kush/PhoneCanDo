package com.phonecando.linux.jobs

import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.records.EnvRecord
import com.phonecando.linux.records.EnvState
import com.phonecando.linux.records.ImageRecord
import com.phonecando.linux.records.ImageState

/**
 * What to do with records a process death left mid-job (state says a job
 * runs, but none does). Pure: records and a liveness check in, the fixed
 * records out.
 *
 * - downloading env, creating image: `failed` with code `cancelled`, so
 *   the UI offers a retry (both resume where they stopped).
 * - resetting image: back to `ready` with the error noted; a reset swaps
 *   the new system in atomically, and the next start finishes or drops a
 *   cut-short swap (ImageSetup.refreshForStart).
 * - deleting image: listed in [Plan.finishDeletes]; the host moves what is
 *   left to the trash and drops the record.
 */
object Recovery {
  const val MESSAGE = "the app stopped before this finished"

  /** The `error` line of a record fixed here (code first, like every failed record). */
  val LINE = LinuxErrorCode.line(LinuxErrorCode.CANCELLED, MESSAGE)

  data class Plan(val envs: List<EnvRecord>, val images: List<ImageRecord>, val finishDeletes: List<String>)

  fun plan(envs: List<EnvRecord>, images: List<ImageRecord>, isLive: (JobTarget) -> Boolean): Plan {
    val code = LinuxErrorCode.CANCELLED.code
    val fixedEnvs = envs.map { env ->
      if (env.state == EnvState.DOWNLOADING && !isLive(JobTarget.env(env.id))) {
        env.copy(state = EnvState.FAILED, error = LINE, errorCode = code)
      } else {
        env
      }
    }
    val deletes = ArrayList<String>()
    val fixedImages = images.map { image ->
      if (isLive(JobTarget.image(image.id))) return@map image
      when (image.state) {
        ImageState.CREATING -> image.copy(state = ImageState.FAILED, error = LINE, errorCode = code)
        ImageState.RESETTING -> image.copy(state = ImageState.READY, error = LINE, errorCode = code)
        ImageState.DELETING -> image.also { deletes += it.id }
        ImageState.READY, ImageState.FAILED -> image
      }
    }
    return Plan(fixedEnvs, fixedImages, deletes)
  }
}
