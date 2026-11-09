package com.phonecando.runner.agents

import com.phonecando.agents.builtin.BuiltinHooks
import java.io.File
import java.io.FileNotFoundException
import java.io.InputStream

// The repo's agent kinds and runtimes as the APK packages them
// (assets/agents/<id>/agent.json, assets/agents/runtimes/<id>/), read from
// agents/{native,image}/<id>/agent.json and agents/runtimes/<id>/ (the
// Gradle test task passes the folder as phonecando.agentsDir).
object TestKinds {
  private val root: File by lazy {
    File(checkNotNull(System.getProperty("phonecando.agentsDir")) { "phonecando.agentsDir is not set" })
  }

  private val manifests: Map<String, File> by lazy {
    listOf("native", "image")
      .flatMap { type -> File(root, type).listFiles().orEmpty().map { File(it, "agent.json") } }
      .filter { it.isFile }
      .associateBy { it.parentFile!!.name }
  }

  /** The packaged manifests and runtimes as an asset tree (config folders not included). */
  val assets = object : AssetTree {
    override fun list(path: String): List<String>? = when {
      path == "agents" -> (manifests.keys + RuntimeCatalog.FOLDER).sorted()
      path.startsWith("agents/runtimes") -> runtimeFile(path).list()?.sorted() ?: emptyList()
      path.startsWith("agents/") && path.removePrefix("agents/") in manifests -> listOf("agent.json")
      else -> emptyList()
    }

    override fun open(path: String): InputStream {
      if (path.startsWith("agents/runtimes/")) return runtimeFile(path).inputStream()
      val id = path.removePrefix("agents/").removeSuffix("/agent.json")
      return manifests[id]?.takeIf { path == "agents/$id/agent.json" }?.inputStream() ?: throw FileNotFoundException(path)
    }

    private fun runtimeFile(path: String) = File(root, path.removePrefix("agents/"))
  }

  /** Every repo runtime; one that does not load fails the test. */
  val runtimes: RuntimeCatalog by lazy {
    RuntimeCatalog.load(assets) { folder, e -> throw AssertionError("runtime $folder does not load: ${e.message}", e) }
  }

  /** Every repo kind with the build's hooks and the repo's runtimes; a kind that does not load fails the test. */
  val catalog: KindCatalog by lazy {
    KindCatalog.load(assets, null, BuiltinHooks.all, runtimes, BuiltinHooks.defaultKindId) { folder, e ->
      throw AssertionError("agent kind $folder does not load: ${e.message}", e)
    }
  }
}
