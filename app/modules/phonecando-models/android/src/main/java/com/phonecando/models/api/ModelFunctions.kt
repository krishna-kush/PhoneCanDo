package com.phonecando.models.api

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.models.ModelsHost
import com.phonecando.models.context.ModelContexts
import com.phonecando.models.errors.ModelErrorCode
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
      val serving = h.serving.current()
      h.store.models().map { it.toMap(device, serving) }
    }
  }

  // The RAM verdict for a model served with `context` tokens as the user
  // would choose it (the Context setting's slider, live): cheap, sync.
  Function("contextCheck") { modelId: String, context: Double ->
    coded {
      val h = host()
      ModelContexts.check(h.device.read(), model(h, modelId), context.toLong()).toMap()
    }
  }

  // Saves the context a model is served with (tokens, or null for
  // automatic) on its record. A running server keeps its own until it
  // starts again: JS then restarts the agents on it (the runner's
  // stopModelAgents). Rejects not_enough_memory past the phone's RAM.
  AsyncFunction("setModelContext") { modelId: String, context: Double?, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val chosen = context?.toLong()
      ModelContexts.requireAllowed(h.device.read(), model(h, modelId), chosen)
      h.store.setContext(modelId, chosen)
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

  // { repo, revision, files: [{ path, sizeBytes, sha256 }], dates }: a variant as repoModels or suggestedModels listed it.
  AsyncFunction("startDownload") { params: Map<String, Any?>, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val repo = params["repo"] as? String ?: throw IllegalArgumentException("repo is required")
      val revision = params["revision"] as? String ?: throw IllegalArgumentException("revision is required")
      @Suppress("UNCHECKED_CAST")
      val files = repoFiles(params["files"] as? List<Map<String, Any?>> ?: throw IllegalArgumentException("files are required"))
      val job = h.downloads.start(h.catalog.request(repo, revision, files, datesOf(params["dates"])))
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

  Function("setHfToken") { token: String -> coded { host().tokens.save(token) } }

  Function("clearHfToken") { coded { host().tokens.clear() } }
}

private fun model(host: ModelsHost, id: String): ModelRecord =
  host.store.models().firstOrNull { it.id == id } ?: throw LmeException.NotFound("model $id")
