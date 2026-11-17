package com.phonecando.runner.update

/**
 * What files/state/update-download.json keeps: the download's spec and the
 * step it was at (`download` while it runs, then `done` or `failed`, with
 * the failure's [error] line and [errorCode]).
 */
data class UpdateRecord(
  val spec: UpdateSpec,
  val step: UpdateStep,
  val error: String? = null,
  val errorCode: String? = null,
)

/**
 * The update download as JS sees it (the state map, also the
 * phonecandoUpdateDownload event): its build, its file, the step, the bytes
 * so far of [UpdateSpec.size], the finished APK's absolute [path] once it is
 * done, and the failure on `failed`. Pure.
 */
data class UpdateState(
  val spec: UpdateSpec,
  val step: UpdateStep,
  val written: Long,
  val path: String? = null,
  val error: String? = null,
  val errorCode: String? = null,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "version" to spec.version,
    "versionCode" to spec.versionCode,
    "name" to spec.name,
    "path" to path,
    "step" to step.wire,
    "written" to written.toDouble(),
    "total" to spec.size.toDouble(),
    "error" to error,
    "errorCode" to errorCode,
  )

  companion object {
    /**
     * The state of [record] while no job runs for it, from what is on
     * disk: [apkLength] of the finished file at [apkPath] (null when there
     * is none) and [partLength] of its `.part`. Done counts only while the
     * finished file is there whole (its sha256 was checked when it
     * finished); null when it is not, as the record is then stale. A
     * record left at a running step lost its process: stopped, and the
     * next start goes on from the `.part`.
     */
    fun ofRecord(record: UpdateRecord, apkPath: String, apkLength: Long?, partLength: Long): UpdateState? = when (record.step) {
      UpdateStep.DONE ->
        if (apkLength == record.spec.size) UpdateState(record.spec, UpdateStep.DONE, record.spec.size, apkPath) else null
      UpdateStep.FAILED -> UpdateState(record.spec, UpdateStep.FAILED, partLength, null, record.error, record.errorCode)
      else -> UpdateState(record.spec, UpdateStep.STOPPED, partLength)
    }
  }
}
