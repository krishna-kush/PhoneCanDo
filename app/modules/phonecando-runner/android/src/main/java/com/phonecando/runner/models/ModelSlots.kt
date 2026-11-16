package com.phonecando.runner.models

import android.content.Context
import android.os.PowerManager
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.chats.ChatStorage
import com.phonecando.models.ModelsHost
import com.phonecando.models.serving.ServingModel
import com.phonecando.models.serving.ServingSource
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.models.measure.ModelMeasurer
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.models.prompt.PromptWatch
import java.io.File
import kotlin.concurrent.thread

// The engine supervisor's model servers, bound to this phone: the server
// binary in the native-library dir, each model's log at
// files/logs/model-server-<id>.log, and the models module's store and
// device reading (ModelsHost, one per process). The runner reads the store
// and keeps two things of its own beside a model's files: what its server
// measured of itself (ModelMeasurer) and its chats on storage
// (files/models/<id>/.chats/, on the volume of files/); downloads,
// imports, deletes and a model's context setting are that module's. It
// tells ModelsHost which models it serves and with what context, so each
// model's card shows its server's own, what each measured, and whether its
// chats can go to storage; and it measures, in the background, every model
// this phone has not yet. Its prompt watch looks only while the screen is
// on.
internal object ModelSlots {
  const val LOG_DIR = "logs"

  fun binding(
    context: Context,
    ports: PortAllocator,
    reaper: ProcessReaper,
    maxModels: () -> Int?,
    onDied: (holders: Set<String>, detail: String) -> Unit,
  ): LocalModelBinding {
    val host = { ModelsHost.get(context) }
    val logs = File(context.filesDir, LOG_DIR)
    val libDir = context.applicationInfo.nativeLibraryDir
    // On the volume of files/: what is free there now.
    val chats = { record: ModelRecord -> ChatStorage(host().store.chatsDir(record.id).absolutePath, context.filesDir.usableSpace) }
    val measurer = ModelMeasurer(
      libDir = libDir,
      binary = ModelServer.BINARY,
      device = { host().device.read() },
      modelFile = { host().store.entryFile(it) },
      read = { host().store.measured(it) },
      save = { id, m -> host().store.saveMeasured(id, m) },
      onMeasured = { host().changed() },
      chats = chats,
    )
    val server = ModelServer(
      ports = ports,
      reaper = reaper,
      libDir = libDir,
      logFile = { File(logs, ModelServer.logName(it)) },
      device = { host().device.read() },
      modelFile = { host().store.entryFile(it) },
      maxModels = maxModels,
      onDied = onDied,
      measurer = measurer,
      chats = chats,
    )
    val binding = LocalModelBinding(server) { host().store.models() }
    host().serving = object : ServingSource {
      override fun current() = binding.serving().map { ServingModel(it.model.id, it.endpoint.contextWindow, it.heldBytes) }

      override fun measured(record: ModelRecord): MeasuredMemory? = measurer.known(record)

      override fun chatStorageFree(record: ModelRecord): Long? = if (server.chatsFailing(record.id)) null else chats(record).freeBytes

      override fun measureSoon(record: ModelRecord) = measurer.measureSoon(record)
    }
    // The models this phone never measured (new ones, or a new server build): their pages count the truth soon.
    thread(name = "phonecando-model-measure", isDaemon = true) {
      try {
        host().store.models().forEach(measurer::measureSoon)
      } catch (_: Exception) {
        // A store we cannot read: each model is measured at its start instead.
      }
    }
    return binding
  }

  /**
   * The prompt reading of a server busy for an agent with a run going
   * ([working]), watched while there is one: with the screen on, or while
   * an ACP turn runs ([acpTurn]: its watch reads the server's work).
   */
  fun promptWatch(
    context: Context,
    binding: LocalModelBinding,
    working: () -> Set<String>,
    acpTurn: () -> Boolean,
    onChange: (PromptReading?) -> Unit,
  ): PromptWatch {
    val power = context.getSystemService(PowerManager::class.java)
    return PromptWatch(
      target = { PromptWatch.busy(binding.serving(), working()) },
      looking = { power?.isInteractive != false || acpTurn() },
      onChange = onChange,
    )
  }
}
