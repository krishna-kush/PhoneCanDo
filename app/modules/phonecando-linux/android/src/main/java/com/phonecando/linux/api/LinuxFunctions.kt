package com.phonecando.linux.api

import com.phonecando.linux.LinuxHost
import com.phonecando.linux.catalog.toMap
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

/**
 * The module's JS surface (typed in app/src/engine/linux/native.ts). Sync
 * calls are cheap reads or small file writes; the async ones (anything
 * that reads the network, an asset or a whole tree) run on our executor. Long jobs resolve at once with their jobId and report through
 * `phonecandoLinuxProgress`; records change through `phonecandoLinuxChanged`.
 */
internal fun ModuleDefinitionBuilder.linuxFunctions(host: () -> LinuxHost) {
  Function("linuxStatus") { coded { host().android.status().toMap() } }

  // Envs.
  Function("listEnvs") { coded { host().envs.list().map { it.toMap() } } }

  AsyncFunction("ensureDefaultEnv") { promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.envs.ensureDefault().toMap() }
  }

  Function("ensureAndroidEnv") { coded { host().envs.ensureAndroid().toMap() } }

  AsyncFunction("createRegistryEnv") { params: Map<String, Any>, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      // A missing or blank image fails as invalid_ref, like any bad reference.
      val (job, env) = h.envs.createRegistry(params["image"] as? String ?: "", params["tag"] as? String ?: "")
      mapOf("jobId" to job.id, "envId" to env.id)
    }
  }

  AsyncFunction("retryEnv") { envId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { mapOf("jobId" to h.envs.retry(envId).id) }
  }

  AsyncFunction("deleteEnv") { envId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.envs.delete(envId).let { null } }
  }

  // Images.
  Function("listImages") { coded { host().images.list().map { it.toMap() } } }

  AsyncFunction("createImage") { envId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val (job, image) = h.images.create(envId)
      mapOf("jobId" to job.id, "imageId" to image.id)
    }
  }

  AsyncFunction("retryImage") { imageId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { mapOf("jobId" to h.images.retry(imageId).id) }
  }

  AsyncFunction("resetImage") { imageId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { mapOf("jobId" to h.images.reset(imageId).id) }
  }

  AsyncFunction("deleteImage") { imageId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.images.delete(imageId).let { null } }
  }

  AsyncFunction("imageSize") { imageId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.images.size(imageId) }
  }

  AsyncFunction("prepareImageForStart") { imageId: String, promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.images.prepareForStart(imageId).let { null } }
  }

  Function("reinstallList") { imageId: String -> coded { host().images.reinstallList(imageId)?.toMap() } }

  Function("clearReinstallList") { imageId: String -> coded { host().images.clearReinstallList(imageId) } }

  Function("terminalRecipe") { imageId: String -> coded { host().images.terminalRecipe(imageId).toMap() } }

  // Docker Hub.
  AsyncFunction("catalogOs") { promise: Promise ->
    val h = host()
    runAsync(h, promise) { h.catalog.officialOs().map { it.toMap() } }
  }

  AsyncFunction("catalogTags") { params: Map<String, Any>, promise: Promise ->
    val h = host()
    runAsync(h, promise) {
      val page = (params["page"] as? Number)?.toInt() ?: 1
      h.catalog.tags(params["repo"] as? String ?: "", page, params["query"] as? String).toMap()
    }
  }

  // Jobs: true when the job was running (it stops at its next check).
  Function("cancelJob") { jobId: String -> host().jobs.cancel(jobId) }
}
