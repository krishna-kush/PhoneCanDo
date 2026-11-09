package com.phonecando.runner.api

import android.content.Context
import com.phonecando.agents.kit.render.ClientContext
import com.phonecando.agents.kit.render.EngineUrl
import com.phonecando.agents.kit.render.KindView
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.WebPairing
import com.phonecando.runner.engine.image.ImageDir
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import java.io.File
import kotlin.concurrent.thread

// The agent kinds for JS: what the app may know about each (KindView, no
// templates, no secrets), and the two things an agent's surfaces need from
// its running engine, rendered here so JS never holds the engine password:
// the web UI's one-time sign-in URL and the TUI client's start recipe. The
// recipe carries the password in its env; JS hands it to the PTY unstored.
internal fun ModuleDefinitionBuilder.kindFunctions(context: () -> Context) {
  // A JSON array of KindView (agents/kit/ts/contract/view.ts), the default
  // kind marked; a native kind's payload is present when every lib it lists
  // is in this build's native-library dir.
  Function("listKinds") {
    val ctx = context()
    val catalog = KindCatalogs.get(ctx)
    val libDir = File(ctx.applicationInfo.nativeLibraryDir)
    KindView.list(catalog.all(), catalog.default?.id.orEmpty()) { File(libDir, it).isFile }
  }

  // The engine must be up (JS starts it first). Rejects with pair_failed and
  // the message the app shows.
  AsyncFunction("pairWebUi") { agentId: String, promise: Promise ->
    val ctx = context()
    thread(name = "phonecando-web-pair", isDaemon = true) {
      try {
        val kind = agentAndKind(ctx, agentId).second
        val store = AgentStores.get(ctx)
        val url = WebPairing.pair(kind) {
          val record = store.get(agentId) ?: throw IllegalArgumentException("unknown agent")
          val port = Engines.get(ctx).livePort(agentId)?.toString() ?: record.port
            ?: throw IllegalStateException("the engine is not running")
          WebPairing.Address(port, record.password)
        }
        promise.resolve(url)
      } catch (e: Exception) {
        promise.reject("pair_failed", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  // { cmd, env, cwd }: the kind's TUI client attached to this agent's engine
  // (its port, or its last one) in [projectDir]; [sessionId] continues that chat.
  Function("clientRecipe") { agentId: String, projectDir: String, sessionId: String? ->
    val ctx = context()
    val (record, kind) = agentAndKind(ctx, agentId)
    val image = ImageDir.of(ctx.filesDir, record.imageId)
    val port = Engines.get(ctx).livePort(agentId)?.toString() ?: record.port
    val recipe = kind.clientRecipe(
      ClientContext(
        libDir = ctx.applicationInfo.nativeLibraryDir,
        home = image.home.path,
        tmp = image.tmp.path,
        serverUrl = port?.let(EngineUrl::base).orEmpty(),
        password = record.password,
        projectDir = projectDir,
        sessionId = sessionId,
      ),
    ) ?: throw IllegalArgumentException("${kind.displayName} has no terminal client")
    mapOf("cmd" to recipe.cmd, "env" to recipe.env, "cwd" to recipe.cwd)
  }
}

private fun agentAndKind(context: Context, agentId: String): Pair<AgentRecord, ManifestKind> {
  val record = AgentStores.get(context).get(agentId) ?: throw IllegalArgumentException("unknown agent")
  val kind = KindCatalogs.get(context).get(record.kind)
    ?: throw IllegalArgumentException("unknown agent kind ${record.kind}")
  return record to kind
}
