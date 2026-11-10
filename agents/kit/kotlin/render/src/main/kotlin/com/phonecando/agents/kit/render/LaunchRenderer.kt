package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.ProjectDir
import com.phonecando.agents.kit.manifest.Command
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
// at their index, or at the end. The TUI client's env starts with what any
// terminal program needs from us, then the kind's: HOME and TMPDIR are the
// image HOME (as the client always had), TERM and COLORTERM say what our
// xterm renders.
object LaunchRenderer {
  fun engine(command: Command, ctx: LaunchContext, resume: Resume? = null): LaunchSpec {
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
    var argv = Templates.argv(command.argv, values)
    if (ctx.resume && resume != null) {
      val at = (resume.at ?: argv.size).coerceIn(0, argv.size)
      argv = argv.subList(0, at) + resume.args.map { Templates.render(it, values) } + argv.subList(at, argv.size)
    }
    val cwd = command.cwd?.let { Templates.render(it, values) }
    return LaunchSpec(argv, Templates.env(command.env, values), cwd)
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
