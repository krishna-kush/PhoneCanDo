package com.phonecando.runner.models.measure

import android.util.Log
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.chats.ChatStorage
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.llamacpp.FitBreakdown
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.runner.models.ServerEnv
import java.io.File
import kotlin.concurrent.thread

// What a model's server holds on this phone, as llama.cpp counts it: a dry
// run of the server with the flags a start would use (FitProbe, lme's
// FitBreakdown), kept beside the model's files (lme's ModelStore, per
// phone and server build) for lme's plan and the Memory page. A start
// measures first when what is kept does not count its plan (MeasurePolicy),
// then plans with it; the models module asks for one in the background
// (measureSoon) for a model never measured here, so its page and its RAM
// verdict count the truth before its first start. One dry run at a time:
// they read the same files a start does.
internal class ModelMeasurer(
  /** The APK's native-library dir. */
  private val libDir: String,
  private val binary: String,
  private val device: () -> DeviceInfo,
  private val modelFile: (ModelRecord) -> File,
  private val read: (modelId: String) -> MeasuredMemory?,
  private val save: (modelId: String, MeasuredMemory) -> Unit,
  /** A measurement was kept: the models' pages read again. */
  private val onMeasured: () -> Unit,
  /** Where a model's chats would be kept, as its start plans them (the context a background dry run measures at). */
  private val chats: (ModelRecord) -> ChatStorage? = { null },
  private val probe: (LlamaCppRuntime.Measure, env: Map<String, String>, phone: String) -> MeasuredMemory? = { m, env, phone ->
    FitProbe.run(m.argv, env, File(libDir)) { FitBreakdown.parse(it, phone, m.context, m.halfKvCache) }
  },
  private val log: (String) -> Unit = { Log.i(TAG, it) },
) {
  private val lock = Any()
  private val asked = HashSet<String>()

  /** This phone and server build, as a measurement names them. */
  fun phone(): String = MeasuredMemory.phoneTag(device().cpuFeatures, File(libDir, binary).length())

  /** What [record]'s server measured on this phone; null when it never did. */
  fun known(record: ModelRecord): MeasuredMemory? = MeasurePolicy.usable(read(record.id), phone())

  /**
   * [request] with its measurement: the one kept when it counts this
   * start's plan, else a fresh dry run's (kept for next time); as it was
   * when the dry run fails (the plan then estimates).
   */
  fun measured(request: LaunchRequest): LaunchRequest {
    // A phone that is not offered local models runs none, not even a dry run (the plan says why).
    if (!RamGate.offered(request.device.totalRamBytes)) return request
    val dry = LlamaCppRuntime.measure(request)
    if (MeasurePolicy.fresh(request.measured, dry.context, dry.halfKvCache)) return request
    return measure(request.model, dry)?.let { request.copy(measured = it) } ?: request
  }

  /** Measures [record] on our own thread when this phone never has, once per process. */
  fun measureSoon(record: ModelRecord) {
    synchronized(asked) { if (!asked.add(record.id)) return }
    if (!RamGate.offered(device().totalRamBytes) || known(record) != null) return
    thread(name = "phonecando-model-measure", isDaemon = true) {
      try {
        val file = modelFile(record)
        if (!file.isFile) return@thread
        val exe = File(libDir, binary)
        if (!exe.isFile) return@thread
        // A port and key of its own: the dry run listens on a port it picks, with a key, until we stop it.
        val request = LaunchRequest(record, file.absolutePath, exe.absolutePath, device(), 1, ApiKeys.newKey(), known(record), chats(record))
        measured(request)
      } catch (e: Exception) {
        log("could not measure model ${record.id}: ${e.message}")
      }
    }
  }

  // One dry run at a time; kept when it parsed.
  private fun measure(record: ModelRecord, dry: LlamaCppRuntime.Measure): MeasuredMemory? = synchronized(lock) {
    val phone = phone()
    val started = System.nanoTime()
    val m = try {
      probe(dry, ServerEnv.of(dry.env, record.id), phone)
    } catch (e: Exception) {
      log("model ${record.id}: the dry run failed: ${e.message}")
      null
    }
    val ms = (System.nanoTime() - started) / 1_000_000
    if (m == null) {
      log("model ${record.id}: no measurement from the dry run (${ms} ms)")
      return@synchronized null
    }
    log(
      "model ${record.id} measured at ${m.context} (${if (m.halfKvCache) "q8_0" else "f16"}) in $ms ms: " +
        "read in place ${m.mappedBytes / MIB} MiB, copied ${m.copiedBytes / MIB} MiB, " +
        "state ${m.stateBytes / MIB} MiB, compute ${m.computeBytes / MIB} MiB",
    )
    try {
      save(record.id, m)
      onMeasured()
    } catch (e: Exception) {
      log("model ${record.id}: could not keep its measurement: ${e.message}")
    }
    m
  }

  private companion object {
    const val TAG = "PhoneCanDoModels"
    const val MIB = 1L shl 20
  }
}
