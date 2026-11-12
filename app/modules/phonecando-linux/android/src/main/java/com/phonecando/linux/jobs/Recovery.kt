package com.phonecando.linux.jobs

import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.records.EnvRecord
import com.phonecando.linux.records.EnvState
import com.phonecando.linux.records.ImageRecord
import com.phonecando.linux.records.ImageState

/**
 * What to do with records a process death left mid-job (state says a job
 * runs, but none does). Pure: records, the env downloads to resume and a
 * liveness check in, the fixed records out.
 *
 * - downloading env on the resume list: left `downloading` and listed in
 *   [Plan.resumeEnvs]; the host starts its download again. A failed env on
 *   the list (its network stayed down) is resumed too. Any other id on the
 *   list comes off it ([Plan.dropResumes]).
 * - downloading env not on the list, creating image: `failed` with code
 *   `cancelled`, so the UI offers a retry (both resume where they stopped).
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

  data class Plan(
    val envs: List<EnvRecord>,
    val images: List<ImageRecord>,
    val finishDeletes: List<String>,
    val resumeEnvs: List<String> = emptyList(),
    val dropResumes: List<String> = emptyList(),
  )

  fun plan(
    envs: List<EnvRecord>,
    images: List<ImageRecord>,
    resumeList: List<String> = emptyList(),
    isLive: (JobTarget) -> Boolean,
  ): Plan {
    val code = LinuxErrorCode.CANCELLED.code
    val resume = ArrayList<String>()
    val fixedEnvs = envs.map { env ->
      if (isLive(JobTarget.env(env.id))) return@map env
      val resumable = env.state == EnvState.DOWNLOADING || env.state == EnvState.FAILED
      when {
        env.id in resumeList && resumable -> env.also { resume += it.id }
        env.state == EnvState.DOWNLOADING -> env.copy(state = EnvState.FAILED, error = LINE, errorCode = code)
        else -> env
      }
    }
    val drop = resumeList.filter { it !in resume && !isLive(JobTarget.env(it)) }
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
    return Plan(fixedEnvs, fixedImages, deletes, resume, drop)
  }
}
