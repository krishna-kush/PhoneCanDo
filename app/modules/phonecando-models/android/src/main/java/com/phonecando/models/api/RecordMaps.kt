package com.phonecando.models.api

import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.known.KnownBases
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.models.context.ModelContexts
import com.phonecando.models.ram.RamChecks
import com.phonecando.models.serving.ServingModel

// The JS shapes of lme's records (LocalModel, ModelDownload and ModelDevice
// in app/src/engine/models/types.ts). Numbers go out as doubles: a JS number
// holds any file size we will ever see.

/** [serving]: the model the runner serves now, if any (its card shows that server's context). */
internal fun ModelRecord.toMap(device: DeviceInfo, serving: ServingModel?): Map<String, Any?> {
  val view = ModelContexts.view(device, this, serving)
  return mapOf(
    "id" to id,
    "name" to name,
    "source" to when (val s = source) {
      is ModelSource.HuggingFace -> mapOf("kind" to "huggingface", "repo" to s.repo, "revision" to s.revision)
      is ModelSource.Imported -> mapOf("kind" to "imported", "fileName" to s.fileName)
    },
    "sizeBytes" to sizeBytes.toDouble(),
    "quant" to shape.quant,
    "architecture" to shape.architecture,
    "parameterCount" to shape.parameterCount?.toDouble(),
    "contextLength" to shape.contextLength?.toDouble(),
    "servedContext" to view.served.toDouble(),
    "autoContext" to view.auto.toDouble(),
    "contextChoice" to view.choice?.toDouble(),
    "contextRange" to view.range.toMap(),
    "serving" to view.serving,
    "addedAt" to addedAtMillis.toDouble(),
    "dates" to datesMap(KnownBases.dates(this)),
    "ram" to view.ram.toMap(),
  )
}

/** `{min, max, step}`: the Context setting's slider. */
internal fun ContextRange.toMap(): Map<String, Any?> = mapOf(
  "min" to min.toDouble(),
  "max" to max.toDouble(),
  "step" to ContextSizing.STEP.toDouble(),
)

/** [doneBytes]: what is on disk (ModelStore.bytesOnDisk); [jobId]: its running job, null when paused. */
internal fun PendingDownload.toMap(doneBytes: Long, jobId: String?): Map<String, Any?> = mapOf(
  "id" to id,
  "name" to name,
  "repo" to repo,
  "revision" to revision,
  "sizeBytes" to sizeBytes.toDouble(),
  "doneBytes" to doneBytes.toDouble(),
  "startedAt" to startedAtMillis.toDouble(),
  "jobId" to jobId,
)

internal fun DeviceInfo.toMap(): Map<String, Any?> {
  val check = RamChecks.device(this)
  return mapOf(
    "supported" to check.supported,
    "reason" to check.reason,
    "totalRamBytes" to totalRamBytes.toDouble(),
    "availableRamBytes" to availableRamBytes.toDouble(),
    "budgetBytes" to RamGate.budget(totalRamBytes).toDouble(),
  )
}

/** A variant's files as JS hands them back to startDownload: `{ path, sizeBytes, sha256 }`. */
internal fun repoFiles(raw: List<Map<String, Any?>>): List<RepoFile> = raw.map { f ->
  val path = f["path"] as? String ?: throw IllegalArgumentException("a file has no path")
  val size = (f["sizeBytes"] as? Number)?.toLong() ?: throw IllegalArgumentException("$path has no size")
  RepoFile(path, size, f["sha256"] as? String)
}
