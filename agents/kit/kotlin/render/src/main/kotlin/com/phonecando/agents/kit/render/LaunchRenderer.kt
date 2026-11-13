package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.ProjectDir
import com.phonecando.agents.kit.manifest.Command
import com.phonecando.agents.kit.manifest.PromptArgs
import com.phonecando.agents.kit.manifest.Resume

/** What the kind's TUI client attaches with: the engine, the agent's image and a project folder. */
data class ClientContext(
  val libDir: String,
  /** The image's HOME. */
  val home: String,
  val tmp: String,
  /** The engine's base URL, "" while it has no port yet. */
  val serverUrl: String,
  val password: String,
  val projectDir: String,
  /** The chat to continue; null or empty lets the client pick by folder. */
  val sessionId: String?,
  /** The agent's own state folder, as the client sees it; null: the kind's default dirs (ManifestKind.clientRecipe). */
  val stateDir: String? = null,
)

/** A process for our PTY: argv, environment (in order) and working directory. */
data class ClientRecipe(val cmd: List<String>, val env: Map<String, String>, val cwd: String)

// A manifest command rendered for one launch. The engine gets only the
// kind's argv, env and cwd here; the host layers that env over the image's.
// An engine runs in its `cwd`, HOME when it names none; {{projectDir}} is
// the work folder in HOME (ProjectDir), which the host makes before a
// launch. An engine with no port (a TUI) has no
// {{port}} or {{serverUrl}}; {{bridgeUrl}} is empty for a kind with no
// bridge, so a `when` item drops its args. When the agent ran before, the resume args go in
// at their index, or at the end. A launch with a first prompt adds the
// kind's prompt args the same way, {{prompt}} filled in as one argv item
// (the value is never read for placeholders again); both indexes count in
// the launch's own argv, and where they meet the resume args come first.
// The TUI client's env starts with what any terminal program needs from
// us, then the kind's: HOME and TMPDIR are the image HOME (as the client
// always had), TERM and COLORTERM say what our xterm renders.
object LaunchRenderer {
  fun engine(command: Command, ctx: LaunchContext, resume: Resume? = null, prompt: PromptArgs? = null): LaunchSpec {
    val values = buildMap {
      put("libDir", ctx.libDir)
      put("home", ctx.home.path)
      put("tmp", ctx.tmp.path)
      put("projectDir", ProjectDir.of(ctx.home).path)
      put("password", ctx.password)
      put("bridgeUrl", ctx.bridgeUrl)
      if (ctx.port.isNotEmpty()) {
        put("port", ctx.port)
        put("serverUrl", EngineUrl.base(ctx.port))
      }
    }
    val own = Templates.argv(command.argv, values)
    val inserts = listOfNotNull(
      resume?.takeIf { ctx.resume }?.let { (it.at ?: own.size) to it.args.map { arg -> Templates.render(arg, values) } },
      prompt?.let { p -> ctx.prompt?.let { text -> (p.at ?: own.size) to promptArgs(p, values, text) } },
    )
    val argv = if (inserts.isEmpty()) own else insert(own, inserts)
    val cwd = command.cwd?.let { Templates.render(it, values) }
    return LaunchSpec(argv, Templates.env(command.env, values), cwd)
  }

  // The prompt args with {{prompt}} as [text]; the rest are templates as any.
  private fun promptArgs(prompt: PromptArgs, values: Map<String, String>, text: String): List<String> {
    val withPrompt = values + (PromptArgs.PLACEHOLDER to text)
    return prompt.args.map { Templates.render(it, withPrompt) }
  }

  // [inserts] (an index in [argv], clamped to it, with its args) put in, in
  // their order where two share an index.
  private fun insert(argv: List<String>, inserts: List<Pair<Int, List<String>>>): List<String> = buildList {
    val at = inserts.map { (index, args) -> index.coerceIn(0, argv.size) to args }
    for (i in 0..argv.size) {
      at.filter { it.first == i }.forEach { addAll(it.second) }
      if (i < argv.size) add(argv[i])
    }
  }

  fun client(command: Command, ctx: ClientContext): ClientRecipe {
    val values = mapOf(
      "libDir" to ctx.libDir,
      "home" to ctx.home,
      "tmp" to ctx.tmp,
      "serverUrl" to ctx.serverUrl,
      "password" to ctx.password,
      "projectDir" to ctx.projectDir,
      "sessionId" to ctx.sessionId.orEmpty(),
    )
    val env = linkedMapOf(
      "HOME" to ctx.home,
      "TMPDIR" to ctx.home,
      "TERM" to "xterm-256color",
      "COLORTERM" to "truecolor",
    )
    env.putAll(Templates.env(command.env, values))
    val cwd = command.cwd?.let { Templates.render(it, values) } ?: ctx.projectDir
    return ClientRecipe(Templates.argv(command.argv, values), env, cwd)
  }
}
