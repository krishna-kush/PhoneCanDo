package com.phonecando.runner.models

import android.content.Context
import android.os.PowerManager
import com.phonecando.models.ModelsHost
import com.phonecando.models.serving.ServingModel
import com.phonecando.models.serving.ServingSource
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.models.prompt.PromptReading
import com.phonecando.runner.models.prompt.PromptWatch
import java.io.File

// The engine supervisor's model slot, bound to this phone: the server binary
// in the native-library dir, its log at files/logs/model-server.log, and
// the models module's store and device reading (ModelsHost, one per
// process). The runner reads the store only; downloads, imports, deletes
// and a model's context setting are that module's. It tells ModelsHost
// which model it serves and with what context, so a model's card shows the
// server's own. Its prompt watch looks only while the screen is on.
internal object ModelSlots {
  const val LOG = "logs/model-server.log"

  fun binding(
    context: Context,
    ports: PortAllocator,
    reaper: ProcessReaper,
    onDied: (holders: Set<String>, detail: String) -> Unit,
  ): LocalModelBinding {
    val host = { ModelsHost.get(context) }
    val server = ModelServer(
      ports = ports,
      reaper = reaper,
      libDir = context.applicationInfo.nativeLibraryDir,
      logFile = File(context.filesDir, LOG),
      device = { host().device.read() },
      modelFile = { host().store.entryFile(it) },
      onDied = onDied,
    )
    val binding = LocalModelBinding(server) { host().store.models() }
    host().serving = ServingSource { binding.serving()?.let { ServingModel(it.model.id, it.endpoint.contextWindow) } }
    return binding
  }

  /** The server's prompt reading, watched while it is busy for an agent with a run going ([working]). */
  fun promptWatch(
    context: Context,
    binding: LocalModelBinding,
    working: () -> Set<String>,
    onChange: (PromptReading?) -> Unit,
  ): PromptWatch {
    val power = context.getSystemService(PowerManager::class.java)
    return PromptWatch(
      target = { PromptWatch.busy(binding.serving(), working()) },
      looking = { power?.isInteractive != false },
      onChange = onChange,
    )
  }
}
