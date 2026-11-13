package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.manifest.ArgvItem
import com.phonecando.agents.kit.manifest.EventSource
import com.phonecando.agents.kit.manifest.HomeSurface
import com.phonecando.agents.kit.manifest.LinuxNeed
import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.PromptArgs

// What ManifestKind.of() refuses: a manifest this build cannot run as it
// says. Each check throws KindException naming the kind and the reason.
internal object KindChecks {
  private const val MAX_RESUME_AT = 256

  // `sh -c <script> <$0> <$1>…`: the script's own args start at index 4.
  private const val SHELL_SCRIPT = "-c"
  private const val FIRST_SCRIPT_ARG = 4

  fun engine(manifest: Manifest) {
    val engine = manifest.engine ?: throw KindException("${manifest.id}: no engine")
    if (engine.launch == null) throw KindException("${manifest.id}: a ${engine.style.wire} engine needs engine.launch")
    engine.resume?.at?.let {
      if (it !in 1..MAX_RESUME_AT) throw KindException("${manifest.id}: engine.resume.at must be 1..$MAX_RESUME_AT")
    }
    engine.prompt?.let { prompt(manifest.id, it, engine.launch!!.argv) }
  }

  // The prompt is one argv item: exactly one arg is `{{prompt}}`, whole,
  // and no other names it. A launch through a shell script (`sh -c`) takes
  // it only past the script's $0, as one of "$@".
  private fun prompt(id: String, prompt: PromptArgs, argv: List<ArgvItem>) {
    val whole = "{{${PromptArgs.PLACEHOLDER}}}"
    val naming = prompt.args.filter { PromptArgs.PLACEHOLDER in Templates.names(it) }
    if (naming != listOf(whole)) throw KindException("$id: engine.prompt.args holds $whole as one whole arg, once")
    val at = prompt.at ?: return
    if (at !in 1..MAX_RESUME_AT) throw KindException("$id: engine.prompt.at must be 1..$MAX_RESUME_AT")
    if ((argv.getOrNull(1) as? ArgvItem.Text)?.template == SHELL_SCRIPT && at < FIRST_SCRIPT_ARG) {
      throw KindException("$id: engine.prompt.at must be past the shell script's \$0 ($FIRST_SCRIPT_ARG or more), or absent")
    }
  }

  // An image kind runs in a Linux image, from a guest command or path.
  fun image(manifest: Manifest) {
    val id = manifest.id
    if (manifest.linux != LinuxNeed.REQUIRED) throw KindException("$id: an image kind needs Linux (requires.linux required)")
    val first = manifest.engine?.launch?.argv?.firstOrNull()
    if (first !is ArgvItem.Text || "{{" in first.template) {
      throw KindException("$id: an image kind's argv[0] is a guest command or path, without placeholders")
    }
  }

  // A server engine is asked over HTTP and has no PTY to read.
  fun server(manifest: Manifest): String {
    val id = manifest.id
    if (manifest.events.any { it is EventSource.Pty }) throw KindException("$id: PTY events need a tui engine")
    if (manifest.events.any { it is EventSource.Hook }) throw KindException("$id: hook events need a tui engine")
    if (manifest.engine?.prompt != null) throw KindException("$id: engine.prompt needs a tui engine (a server takes a task through its inbox)")
    return manifest.engine?.readiness?.http?.path ?: throw KindException("$id: a server engine needs engine.readiness.http")
  }

  // A TUI engine has no port, so nothing that asks it over HTTP; its
  // patterns must compile, as the host runs them on its output.
  fun tui(manifest: Manifest) {
    val id = manifest.id
    val engine = manifest.engine!!
    val serverOnly = listOfNotNull(
      "engine.auth".takeIf { engine.auth != null },
      "engine.readiness.http".takeIf { engine.readiness?.http != null },
      "events[].sse".takeIf { manifest.events.any { it is EventSource.Sse } },
      "chats.title".takeIf { manifest.chats?.title != null },
      "surfaces.web".takeIf { manifest.surfaces?.web != null },
      "a web Home".takeIf { manifest.surfaces?.home == HomeSurface.WEB },
    )
    if (serverOnly.isNotEmpty()) throw KindException("$id: a tui engine cannot have ${serverOnly.joinToString()}")
    engine.readiness?.output?.let { o ->
      o.settleMs?.let { inRange(id, "settleMs", it, 0..60_000) }
      o.timeoutSec?.let { inRange(id, "timeoutSec", it, 1..3_600) }
    }
    engine.readiness?.alive?.ms?.let { inRange(id, "ms", it, 0..60_000) }
    val patterns = manifest.events.filterIsInstance<EventSource.Pty>().flatMap { p -> p.rules.mapNotNull { it.match } } +
      listOfNotNull(manifest.surfaces?.chatTitle)
    patterns.forEach { compiles(id, it) }
  }

  // An install ends in its version check, whose pattern the host runs.
  fun install(manifest: Manifest) {
    val id = manifest.id
    if (manifest.install == null) {
      if (manifest.runtimes.isNotEmpty()) throw KindException("$id: requires.runtimes need an install")
      if (manifest.update != null || manifest.versionCheck != null) throw KindException("$id: update and versionCheck need an install")
      return
    }
    val check = manifest.versionCheck ?: throw KindException("$id: an install needs a versionCheck")
    compiles(id, check.pattern)
  }

  // A state block moves something, and the instructions file moves with it
  // exactly when the kind has one; config.into moves only when there is one.
  fun state(manifest: Manifest) {
    val id = manifest.id
    val state = manifest.state ?: return
    if (state.env.isEmpty()) throw KindException("$id: state.env moves nothing")
    if ((state.instructions == null) != (manifest.instructions == null)) {
      throw KindException("$id: state.instructions goes with instructions, and only with them")
    }
    if (state.config != null && manifest.config == null) throw KindException("$id: state.config needs a config block")
  }

  // The host deletes these, so each is a plain path in HOME and nothing
  // the machine's other agents share (UserStatePaths).
  fun userState(manifest: Manifest) {
    for (path in manifest.userState) {
      UserStatePaths.problem(path)?.let { throw KindException("${manifest.id}: userState $path $it") }
    }
  }

  fun web(manifest: Manifest) {
    val web = manifest.surfaces?.web
    if (manifest.surfaces?.home == HomeSurface.WEB && (web?.pair == null || web.adapter == null)) {
      throw KindException("${manifest.id}: a web Home needs surfaces.web.pair and surfaces.web.adapter")
    }
  }

  /** The SSE stream (one at most) with its parser; throws for a hook the manifest names that [hooks] lacks. */
  fun hooks(manifest: Manifest, hooks: KindHooks?): Pair<EventSource.Sse, (String) -> EngineEvent?>? {
    val id = manifest.id
    if (hooks != null && hooks.id != id) throw KindException("$id: hooks are ${hooks.id}'s")
    // Every hook id names one of KindHooks' functions; SSE parsers are the only kind so far.
    val missing = manifest.hooks.filterNot { hooks?.sseParser(it) != null }
    if (missing.isNotEmpty()) throw KindException("$id: no hook ${missing.joinToString()} in this build")
    val streams = manifest.events.filterIsInstance<EventSource.Sse>()
    if (streams.size > 1) throw KindException("$id: this build reads one event stream per kind")
    val sse = streams.firstOrNull() ?: return null
    val parser = hooks?.sseParser(sse.parser) ?: throw KindException("$id: no sse parser ${sse.parser} in this build")
    return sse to parser
  }

  private fun inRange(id: String, name: String, value: Int, range: IntRange) {
    if (value !in range) throw KindException("$id: engine.readiness $name must be ${range.first}..${range.last}")
  }

  private fun compiles(id: String, pattern: String) {
    try {
      Regex(pattern)
    } catch (e: IllegalArgumentException) {
      throw KindException("$id: the pattern $pattern does not compile (${e.message?.lineSequence()?.firstOrNull()})")
    }
  }
}
