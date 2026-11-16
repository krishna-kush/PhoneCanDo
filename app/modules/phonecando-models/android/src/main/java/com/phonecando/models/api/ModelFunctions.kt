package com.phonecando.models.api

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.models.ModelsHost
import com.phonecando.models.errors.ModelErrorCode
import com.phonecando.models.memory.ModelMemory
import com.phonecando.models.picker.FilePicker
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

/**
 * The module's JS surface (typed in app/src/engine/models/native.ts). Sync
 * calls are cheap reads; anything that reads the network or a whole file
 * runs on our executor. Long jobs (download, import) resolve at once with
 * their jobId and report through `phonecandoModelsProgress`; models and
 * downloads change through `phonecandoModelsChanged`. The Hugging Face
 * token goes in and never comes back out.
 */
internal fun ModuleDefinitionBuilder.modelFunctions(host: () -> ModelsHost, picker: FilePicker, activity: () -> android.app.Activity?) {
  Function("deviceInfo") { coded { host().device.read().toMap() } }

  Function("suggestedModels") { coded { host().catalog.suggested() } }

  Function("listModels") {
    coded {
      val h = host()
      val device = h.device.read()
      val source = h.serving
      val serving = source.current()
      h.store.models().map { record ->
        record.toMap(device, serving.firstOrNull { it.modelId == record.id }, source.measured(record), source.chatStorageFree(record))
      }
    }
  }

  // What a model gets on this phone with these Memory choices (`context`
  // null for automatic): the setting's line, live as they change. Cheap,
  // sync.
  Function("memoryCheck") { modelId: String, context: Double?, memory: Map<String, Any?> ->
    coded {
      val h = host()
      val record = model(h, modelId)
      val source = h.serving
      val serving = source.current().firstOrNull { it.modelId == modelId }
      val serve = serveChoices(memory, record.serve.detailedLog)
      ModelMemory.view(h.device.read(), record, context?.toLong(), serve, serving, source.measured(record), source.chatStorageFree(record)).toMap()
    }
  }

  // Saves how a model is served: its context (tokens, or null for
  // automatic) and the rest of its Memory choices. A running server keeps
  // its own until it starts again: JS then restarts the agents on it (the
  // runner's stopModelAgents). Rejects not_enough_memory when the model
  // would not run.
  AsyncFunction("setModelMemory") { modelId: String, context: Double?, memory: Map<String, Any?>, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val record = model(h, modelId)
      val chosen = context?.toLong()
      val serve = serveChoices(memory, record.serve.detailedLog)
      ModelMemory.requireAllowed(h.device.read(), record, chosen, serve, h.serving.measured(record))
      h.store.setServing(modelId, chosen, serve)
      h.changed()
      null
    }
  }

  // Turns a model's detailed server log on or off (its Server log page):
  // its next start logs at trace level with the slots' token diffs, prompt
  // text included. JS restarts the agents on it, as for Memory.
  AsyncFunction("setModelDetailedLog") { modelId: String, on: Boolean, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val record = model(h, modelId)
      h.store.setServing(modelId, record.context, record.serve.copy(detailedLog = on))
      h.changed()
      null
    }
  }

  Function("listDownloads") {
    coded {
      val h = host()
      h.store.downloads().map { it.toMap(h.store.bytesOnDisk(it), h.downloads.jobOf(it.id)?.id) }
    }
  }

  // Hugging Face: GGUF repositories under the list's filters ({ sort, size?, license?, chatOnly }); then a repository's models.
  AsyncFunction("searchModels") { query: String, filters: Map<String, Any?>, limit: Int, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.catalog.search(query, filtersOf(filters), limit) }
  }

  AsyncFunction("nextModelsPage") { cursor: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.catalog.nextPage(cursor) }
  }

  AsyncFunction("repoModels") { repo: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.catalog.repo(repo) }
  }

  // Search hits' size ranges, { repo: { count, smallest, largest } }, for the rows that came into view.
  AsyncFunction("repoSizes") { repos: List<String>, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.catalog.repoSizes(repos) }
  }

  // Seconds until Hugging Face takes calls again after a rate_limited answer; null while it does.
  Function("hubCooldown") { coded { host().catalog.cooldownSeconds()?.toDouble() } }

  // A variant as repoModels or suggestedModels listed it: files [{ path, sizeBytes, sha256 }], dates or null.
  // Each object is its own typed argument: Expo converts a null held by a Map<String, Any?> value, but
  // not one inside an object or array held by Any ("Value is null, expected an Object"), such as a
  // sha256 or cutoff of null.
  AsyncFunction("startDownload") { repo: String, revision: String, files: List<Map<String, Any?>>, dates: Map<String, Any?>?, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val job = h.downloads.start(h.catalog.request(repo, revision, repoFiles(files), datesOf(dates)))
      mapOf("jobId" to job.id, "downloadId" to job.target.id)
    }
  }

  AsyncFunction("resumeDownload") { downloadId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { mapOf("jobId" to h.downloads.resume(downloadId).id) }
  }

  // A model or a pending download, with its files; a running download is stopped first.
  AsyncFunction("deleteModel") { id: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.downloads.delete(id).let { null } }
  }

  // The system file picker (opened on the main thread), then the copy as a
  // job: { jobId }, or null when the user backed out.
  AsyncFunction("importModel") { promise: Promise ->
    val h = host()
    try {
      picker.open(activity()) { uri ->
        if (uri == null) {
          promise.resolve(null)
        } else {
          runAsync(h, promise) { mapOf("jobId" to h.imports.start(uri).id) }
        }
      }
    } catch (e: Throwable) {
      promise.reject(ModelErrorCode.of(e).code, ModelErrorCode.messageOf(e), e)
    }
  }.runOnQueue(Queues.MAIN)

  Function("cancelModelJob") { jobId: String -> coded { host().jobs.cancel(jobId) } }

  // The token is write-only from JS.
  Function("hasHfToken") { coded { host().tokens.has() } }

  Function("setHfToken") { token: String ->
    coded {
      val h = host()
      h.tokens.save(token)
      h.catalog.tokenChanged()
    }
  }

  Function("clearHfToken") {
    coded {
      val h = host()
      h.tokens.clear()
      h.catalog.tokenChanged()
    }
  }
}

private fun model(host: ModelsHost, id: String): ModelRecord =
  host.store.models().firstOrNull { it.id == id } ?: throw LmeException.NotFound("model $id")
