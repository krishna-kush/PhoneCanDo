package com.phonecando.runner.update

import com.phonecando.runner.schedule.StateFile
import org.json.JSONObject
import java.io.File

// files/state/update-download.json: {url, name, size, sha256, versionCode,
// version, step, error?, errorCode?}, written whole and atomically, synced
// to the disk (StateFile), so a process death or a reboot finds it. A file
// that does not read, or holds a spec we would refuse now, is no record.
// Plain JVM IO.
class UpdateStore(private val file: File) {
  private val state = StateFile(file)

  fun load(): UpdateRecord? {
    val o = try {
      state.read()?.let(::JSONObject)
    } catch (_: Exception) {
      null
    } ?: return null
    val spec = try {
      SpecRules.parse(o.toMap())
    } catch (_: UpdateSpecException) {
      return null
    }
    val step = UpdateStep.of(o.optString("step")) ?: return null
    return UpdateRecord(spec, step, o.optString("error").ifEmpty { null }, o.optString("errorCode").ifEmpty { null })
  }

  /** @throws java.io.IOException when the disk refuses it. */
  fun save(record: UpdateRecord) {
    val spec = record.spec
    val o = JSONObject()
      .put("url", spec.url)
      .put("name", spec.name)
      .put("size", spec.size)
      .put("sha256", spec.sha256)
      .put("versionCode", spec.versionCode)
      .put("version", spec.version)
      .put("step", record.step.wire)
    record.error?.let { o.put("error", it) }
    record.errorCode?.let { o.put("errorCode", it) }
    state.write(o.toString())
  }

  fun delete() {
    file.delete()
  }

  private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { opt(it) }
}
