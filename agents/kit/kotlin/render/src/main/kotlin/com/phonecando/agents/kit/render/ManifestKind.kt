package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.AgentConfig
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.HttpProbe
import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.InboxRequest
import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.agents.kit.manifest.Command
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.manifest.EventSource
import com.phonecando.agents.kit.manifest.InboxSpec
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.PhoneTools
import com.phonecando.agents.kit.manifest.PtyEvent
import com.phonecando.agents.kit.manifest.PtyRule
import com.phonecando.agents.kit.manifest.VersionCheck
import java.io.File

// An agent kind made from its agent.json plus its code hooks: every request,
// launch and parse the host needs, rendered from the manifest's templates.
// A server engine serves HTTP on its port: every request to it carries the
// manifest's auth (`engine.auth`); the event stream also asks for
// text/event-stream. A TUI engine is the kind's own TUI on a PTY the host
// keeps: no port, no requests; its readiness, PTY rules, hook events and
// chat title pattern are read here. An image kind's program runs inside its
// image and sees only guest paths (ImageLaunch), with the runtimes it needs
// first on PATH, once its install (InstallRenderer) has put them and the
// kind there. An agent given a state folder of its own keeps its state
// there (StateSeam), and its instructions file and config move with it.
// Other agents' messages reach a running agent as its `inbox` says
// (InboxSeam): its hooks print them, or its server takes them. A TUI kind
// with `engine.prompt` can start with a first prompt (a scheduled task).
// of() refuses a kind this build cannot run (KindChecks throws
// KindException), so the catalog never holds one.
class ManifestKind private constructor(
  val manifest: Manifest,
  /** The runtime plugins the kind needs, in manifest order. */
  val runtimes: List<BoundRuntime>,
  private val launchCommand: Command,
  /** Server only. */
  private val readinessPath: String?,
  private val sse: EventSource.Sse?,
  private val parser: ((String) -> EngineEvent?)?,
) : AgentKind {
  override val id: String get() = manifest.id
  override val displayName: String get() = manifest.label

  val style: EngineStyle get() = manifest.engine!!.style

  /** When a TUI engine counts as ready; null for a server. */
  val tuiReadiness: TuiReadiness? = if (style == EngineStyle.TUI) TuiReadiness.of(manifest.engine?.readiness) else null

  /** The rules over a TUI engine's PTY output (`events[].pty.rules`), in order. */
  val ptyRules: List<PtyRule> = manifest.events.filterIsInstance<EventSource.Pty>().flatMap { it.rules }

  /** A regex whose group 1 is the chat title in a TUI's window title: a TUI engine's own, or a server's TUI client's. */
  val chatTitle: String?
    get() = if (style == EngineStyle.TUI) manifest.surfaces?.chatTitle else manifest.surfaces?.terminal?.chatTitle

  /** Whether PTY output is activity (`idle.from` has "output"). */
  val watchesOutput: Boolean get() = manifest.idle?.from?.contains(IDLE_FROM_OUTPUT) == true

  /** The names the kind's hooks pass to `phonecando-event` (`events[].hook.map`), each with the event it raises; the first item naming one wins. */
  val hookEvents: Map<String, PtyEvent> = buildMap {
    for (hook in manifest.events.filterIsInstance<EventSource.Hook>()) {
      hook.map.forEach { (name, event) -> if (name !in this) put(name, event) }
    }
  }

  /** The families the kind installs on, its runtimes' included; null for any. */
  val families: List<String>? = RuntimeBinding.families(manifest, runtimes)

  /** The kind is installed into its machine before its agent starts. */
  val hasInstall: Boolean get() = manifest.install != null

  /** The env names the agent's image must not inherit (GuestEnvPolicy). */
  val guestUnset: List<String> = GuestEnvPolicy.unset(manifest)

  override val config: AgentConfig? = manifest.config?.let {
    AgentConfig(KindAssets.config(manifest.id), it.into, it.keep.toSet())
  }

  override val ownStateSupported: Boolean get() = manifest.state != null

  override fun instructionsFile(home: File, stateDir: File?): File? {
    val file = manifest.instructions ?: return null
    // KindChecks: a state block names the instructions file of a kind that has one.
    return ownState(stateDir)?.let { File(stateDir, it.instructions!!) } ?: File(home, file)
  }

  override fun configDir(home: File, stateDir: File?): File? {
    val config = manifest.config ?: return null
    return ownState(stateDir)?.config?.let { File(stateDir, it) } ?: File(home, config.into)
  }

  override fun userStatePaths(home: File): List<File> = manifest.userState.map { File(home, it) }

  private val auth = manifest.engine?.auth

  override fun launch(ctx: LaunchContext): LaunchSpec {
    val state = ownState(ctx.stateDir)
    if (manifest.type != TYPE_IMAGE) {
      val spec = LaunchRenderer.engine(launchCommand, ctx, manifest.engine?.resume, startPrompt(ctx))
      return withModel(state?.let { StateSeam.apply(spec, it, ctx.stateDir!!.path) } ?: spec, ctx)
    }
    // Everything the program sees is the guest's: {{home}}, {{tmp}},
    // {{projectDir}} and {{stateDir}}, its runtimes' paths, HOME, TMPDIR and
    // its cwd, which the image's sh enters (ImageLaunch); the process starts
    // in HOME.
    val guest = ctx.copy(home = File(ImageLaunch.GUEST_HOME), tmp = File(ImageLaunch.GUEST_TMP))
    val rendered = LaunchRenderer.engine(launchCommand, guest, manifest.engine?.resume, startPrompt(ctx))
    val own = state?.let { StateSeam.apply(rendered, it, StateSeam.guestPath(ctx.stateDir!!, ctx.home)) }
    val spec = withModel(own ?: rendered, ctx)
    val image = ctx.image ?: throw KindException("$id: an image kind runs in its image, and none was given")
    val paths = RuntimeBinding.paths(runtimes, ImageLaunch.GUEST_HOME)
    return LaunchSpec(
      argv = ImageLaunch.wrap(spec.argv, image, paths, cwd = spec.cwd ?: ImageLaunch.GUEST_HOME, carry = ctx.carry),
      env = spec.env + ImageLaunch.GUEST_DIRS,
      cwd = null,
    )
  }

  override val promptsAtStart: Boolean get() = manifest.engine?.prompt != null

  // The kind's prompt args for a launch with a first prompt; a kind that
  // cannot start with one refuses it rather than start without the task.
  private fun startPrompt(ctx: LaunchContext) = ctx.prompt?.let {
    manifest.engine?.prompt ?: throw KindException("$id cannot start with a prompt (no engine.prompt)")
  }

  // The kind's state block when the agent has a state folder of its own
  // ([stateDir]); null when it has none. A kind that keeps no state per
  // agent cannot take one: its agents would share their state unknowingly.
  private fun ownState(stateDir: File?) = stateDir?.let {
    manifest.state ?: throw KindException("$id keeps no state per agent, so its agents cannot have a state folder of their own")
  }

  /** The API this kind would use a model server serving [served] with; null: it can use none. */
  fun modelApi(served: List<String>): String? = ModelSeam.pick(manifest.models, served)?.api

  // The agent's local model, wired as the kind's `models` says; the host
  // checks modelApi first, so a kind that cannot take it never gets here.
  private fun withModel(spec: LaunchSpec, ctx: LaunchContext): LaunchSpec {
    val model = ctx.model ?: return spec
    val wiring = ModelSeam.pick(manifest.models, model.apis)
      ?: throw KindException("$id takes no model over ${model.apis.joinToString()}")
    return ModelSeam.apply(spec, wiring, model)
  }

  /**
   * The install into an image of [family], for the guest's `sh -s` with HOME
   * the image home; null when the kind has none. Throws NoRecipe when it
   * cannot be installed on that family.
   */
  fun installPlan(family: String): InstallPlan? = InstallRenderer.plan(manifest, runtimes, family)

  /** Like [installPlan], running the kind's update steps; null when it has no install or no update. */
  fun updatePlan(family: String): InstallPlan? = InstallRenderer.updatePlan(manifest, runtimes, family)

  /** The installed kind's version check, its argv's {{home}} filled with [home] (no shell runs it); null when the kind has no install. */
  fun versionCheck(home: String): VersionCheck? = manifest.versionCheck?.takeIf { hasInstall }?.let { check ->
    VersionCheck(check.argv.map { Templates.render(it, mapOf("home" to home)) }, check.pattern)
  }

  /** The version in the version check's [output]; null when it names none (or the kind has no check). */
  fun parseVersion(output: String): String? = manifest.versionCheck?.let { VersionParse.parse(output, it.pattern) }

  override fun healthProbe(port: String, password: String): HttpProbe {
    val path = readinessPath ?: throw KindException("$id: a ${style.wire} engine has no health probe")
    return HttpProbe(url(port, path), SecretForms.headers(auth, password))
  }

  override fun eventStream(port: String, password: String): HttpProbe? = sse?.let {
    HttpProbe(url(port, it.path), SecretForms.headers(auth, password) + ("Accept" to "text/event-stream"))
  }

  override fun parseEvent(frame: String): EngineEvent? = parser?.invoke(frame)

  override fun sessionInfo(port: String, password: String, sessionId: String): HttpProbe? =
    manifest.chats?.title?.let {
      HttpProbe(url(port, it.path, mapOf("sessionId" to sessionId)), SecretForms.headers(auth, password))
    }

  override fun parseSessionTitle(body: String): String? = manifest.chats?.title?.let {
    JsonPointer.text(body, it.pointer)?.trim()?.ifEmpty { null }
  }

  override fun passwordForms(password: String): List<String> = SecretForms.of(auth, password)

  /** How other agents' messages reach a running agent of this kind (`inbox`); null: it only pulls them. */
  val inbox: InboxSpec? get() = manifest.inbox

  override val canWake: Boolean get() = manifest.inbox?.wake != null

  override val messaging: MessagingLevel
    get() = MessagingLevel.of(
      phoneTools = (manifest.phoneTools ?: PhoneTools.NONE) != PhoneTools.NONE,
      pushed = manifest.inbox != null,
      wakes = canWake,
    )

  override val wakeNeedsWaiter: Boolean get() = manifest.inbox?.wake == InboxWake.HOOK

  /**
   * What `phonecando-inbox <[event]>` prints: the hook's template with
   * {{messages}} the runner's rendered [messages] (escaped for format json).
   * Throws KindException for an event the inbox does not name.
   */
  fun renderInboxHook(event: String, messages: String): String {
    val hook = manifest.inbox?.hooks?.get(event) ?: throw KindException("$id: no inbox hook $event")
    return InboxSeam.hook(hook, messages)
  }

  override fun inboxRequest(which: InboxCall, port: String, password: String, sessionId: String, messages: String): InboxRequest? {
    val server = manifest.inbox?.server ?: return null
    val endpoint = when (which) {
      InboxCall.DELIVER -> server.deliver
      InboxCall.WAKE -> server.wake
    } ?: return null
    return InboxSeam.request(endpoint, auth, port, password, sessionId, messages)
  }

  override fun inboxLatestRequest(port: String, password: String): InboxRequest? =
    manifest.inbox?.server?.latest?.let { InboxSeam.latest(it, auth, port, password) }

  override fun inboxLatestId(answer: String): String? =
    manifest.inbox?.server?.latest?.let { JsonPointer.text(answer, it.id) }?.takeIf { it.isNotBlank() }

  override fun inboxCreateRequest(port: String, password: String, title: String): InboxRequest? =
    manifest.inbox?.server?.create?.let { InboxSeam.create(it, auth, port, password, title) }

  override fun inboxCreatedId(answer: String): String? =
    manifest.inbox?.server?.create?.let { JsonPointer.text(answer, it.id) }?.takeIf { it.isNotBlank() }

  /**
   * The kind's TUI attached to its running engine; null when it has none.
   * An agent with a state folder of its own has its client read that too:
   * the state env comes after the client's own.
   */
  fun clientRecipe(ctx: ClientContext): ClientRecipe? {
    val client = manifest.surfaces?.terminal?.client ?: return null
    val recipe = LaunchRenderer.client(client, ctx)
    val state = ownState(ctx.stateDir?.let(::File)) ?: return recipe
    return recipe.copy(env = recipe.env + StateSeam.env(state, ctx.stateDir!!))
  }

  /** The request that mints a one-time web UI sign-in; null when the kind has no web pairing. */
  fun pairRequest(port: String, password: String): HttpProbe? = manifest.surfaces?.web?.pair?.let {
    // As the app's REST client always sent it: JSON, with an empty body.
    val headers = linkedMapOf("Content-Type" to "application/json") + SecretForms.headers(auth, password)
    HttpProbe(url(port, it.path), headers, it.method)
  }

  /**
   * The sign-in URL from [pairRequest]'s answer: the code at the first of
   * the manifest's pointers that has one, in its `url`, on the engine.
   * Throws when the answer holds no code.
   */
  fun pairUrlFrom(body: String, port: String): String {
    val pair = manifest.surfaces?.web?.pair ?: throw KindException("$id has no web pairing")
    val code = pair.code.firstNotNullOfOrNull { pointer -> JsonPointer.text(body, pointer)?.takeIf { it.isNotEmpty() } }
      ?: throw IllegalStateException("serve empty pairing code")
    return url(port, pair.url, mapOf("code" to code))
  }

  /**
   * Idle once nothing from the manifest's `idle.from` sources ("events": the
   * last activity event; "output": a TUI's last PTY output) happened for
   * `quietSec`. A source with nothing since the start is quiet, and an
   * engine of a kind without an idle rule, or one that watches nothing, is
   * idle.
   */
  fun isIdle(lastEventAt: Long?, lastOutputAt: Long?, nowMs: Long): Boolean {
    val rule = manifest.idle ?: return true
    val watched = listOfNotNull(
      lastEventAt.takeIf { IDLE_FROM_EVENTS in rule.from },
      lastOutputAt.takeIf { IDLE_FROM_OUTPUT in rule.from },
    )
    return watched.all { nowMs - it >= rule.quietSec * 1000L }
  }

  // A manifest path on this engine; placeholder values are URI components.
  private fun url(port: String, path: String, values: Map<String, String> = emptyMap()) =
    EngineUrl.base(port) + Templates.render(path, values, Templates::uriComponent)

  companion object {
    private const val IDLE_FROM_EVENTS = "events"
    private const val IDLE_FROM_OUTPUT = "output"
    private const val TYPE_IMAGE = "image"

    /**
     * Binds [manifest] to its kind's [hooks] (null: the kind has none) and
     * to the runtime plugins it needs, from [runtimes] (this build's, by
     * id). Throws KindException for what this build cannot run: a block its
     * engine style or Home surface needs, one that style cannot have, a
     * pattern that does not compile, more than one event stream, a hook the
     * manifest names that [hooks] lacks, an install without a version
     * check, a state block that does not fit the kind, a userState path
     * the machine's agents share, an inbox it cannot use (InboxChecks), or
     * a runtime [runtimes] lacks or provides too old.
     */
    fun of(manifest: Manifest, hooks: KindHooks?, runtimes: Map<String, RuntimePlugin> = emptyMap()): ManifestKind {
      KindChecks.engine(manifest)
      val engine = manifest.engine!!
      if (manifest.type == TYPE_IMAGE) KindChecks.image(manifest)
      val readiness = when (engine.style) {
        EngineStyle.SERVER -> KindChecks.server(manifest)
        EngineStyle.TUI -> {
          KindChecks.tui(manifest)
          null
        }
      }
      KindChecks.web(manifest)
      KindChecks.install(manifest)
      KindChecks.state(manifest)
      KindChecks.userState(manifest)
      InboxChecks.check(manifest)
      val stream = KindChecks.hooks(manifest, hooks)
      val bound = RuntimeBinding.bind(manifest, runtimes)
      return ManifestKind(manifest, bound, engine.launch!!, readiness, stream?.first, stream?.second)
    }
  }
}
