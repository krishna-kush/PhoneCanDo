package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.manifest.ArgvItem
import com.phonecando.agents.kit.manifest.Command
import com.phonecando.agents.kit.manifest.ModelWiring
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.LaunchRenderer
import com.phonecando.agents.kit.render.ModelSeam
import com.phonecando.agents.kit.render.RuntimeBinding
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.io.PrintStream

// kit-cli render-model: a kind's one-shot run (OneShot) with a local model,
// wired as the runner wires one into a launch: the one-shot argv, the
// kind's launch env and then the one-shot's, and the model through
// ModelSeam (its args right after the program, its env last). Guest side,
// as the program sees it in its image: {{home}} is /root, {{projectDir}}
// /root/projects (`cwd` when the launch names it; the caller makes it),
// {{tmp}} is /tmp, HOME and TMPDIR are set, and `path` holds the
// runtimes' folders to put first on PATH; no shims/sh, no bridge, no engine
// password. A native kind runs from --lib-dir.
//
// The model server's key is read from the variable --key-env names and
// never printed: an env value that holds it goes under `keyEnv` with
// {{modelKey}} in its place, and `key` names the variable. One JSON line on
// stdout:
//   {"kind", "type", "api", "argv", "cwd", "path", "env", "keyEnv", "key"}
object RenderModel {
  const val USAGE = "kit-cli render-model --kind <dir> --base-url <url> --model <id> --context <tokens> " +
    "--apis <api,...> --key-env <NAME> --prompt <text> [--lib-dir <dir>] [--runtimes <dir>]"

  /** What stands for the key in a rendered value: the placeholder itself, which no other value can hold. */
  const val KEY_MARK = "{{modelKey}}"

  private val ENV_NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")
  private val BASE_URL = Regex("https?://[^\\s/]+(/\\S*)?")

  /** What render-model was asked for. */
  data class Request(
    val kind: File,
    val baseUrl: String,
    val model: String,
    val contextWindow: Int,
    /** The wire APIs the server serves. */
    val apis: List<String>,
    val keyEnv: String,
    val prompt: String,
    val libDir: String?,
    val runtimes: File,
  )

  /** The request in [args] (after the command). Throws IllegalArgumentException for bad usage. */
  fun parse(args: List<String>): Request {
    val options = Options.parse(
      args,
      valued = setOf("--kind", "--base-url", "--model", "--context", "--apis", "--key-env", "--prompt", "--lib-dir", "--runtimes"),
    )
    val kind = File(options.required("--kind"))
    val baseUrl = options.required("--base-url").trimEnd('/')
    require(BASE_URL.matches(baseUrl)) { "--base-url is an http(s) URL" }
    val context = options.required("--context").toIntOrNull()?.takeIf { it > 0 }
      ?: throw IllegalArgumentException("--context is a positive number of tokens")
    val apis = options.required("--apis").split(',').map { it.trim() }.filter { it.isNotEmpty() }
    require(apis.isNotEmpty() && apis.all { it in ModelWiring.APIS }) { "--apis takes ${ModelWiring.APIS.joinToString()}" }
    val keyEnv = options.required("--key-env")
    require(ENV_NAME.matches(keyEnv)) { "--key-env is a variable name" }
    return Request(
      kind = kind,
      baseUrl = baseUrl,
      model = options.required("--model"),
      contextWindow = context,
      apis = apis,
      keyEnv = keyEnv,
      prompt = options.required("--prompt"),
      libDir = options.opt("--lib-dir"),
      runtimes = options.opt("--runtimes")?.let(::File) ?: KitFolders.runtimesBeside(kind),
    )
  }

  fun run(request: Request, env: (String) -> String?, out: PrintStream, err: PrintStream): Int {
    require(!env(request.keyEnv).isNullOrEmpty()) { "${request.keyEnv} (--key-env) holds no key" }
    val manifest = KitFolders.kind(request.kind)
    val id = manifest.id
    if (manifest.models.isEmpty()) throw Refused("$id takes no local model (no models block)")
    val wiring = ModelSeam.pick(manifest.models, request.apis)
      ?: throw Refused("$id speaks ${manifest.models.joinToString { it.api }}; the server serves ${request.apis.joinToString()}")
    val oneShot = KitFolders.oneShot(request.kind) ?: throw Refused("$id has no one-shot mode (${OneShot.FILE})")
    val launch = manifest.engine?.launch ?: throw Refused("$id has no engine launch")
    val image = manifest.type == TYPE_IMAGE
    require(image || request.libDir != null) { "$id is a native kind: --lib-dir is where its libs are" }

    // The prompt is the caller's text, never a template: it goes in after rendering.
    val command = Command(
      argv = oneShot.argv.map { ArgvItem.Text(if (it == OneShot.PROMPT) "" else it) },
      env = launch.env + oneShot.env,
      cwd = launch.cwd,
    )
    val home = File(ImageLaunch.GUEST_HOME)
    val ctx = LaunchContext(request.libDir.orEmpty(), home, File(ImageLaunch.GUEST_TMP), port = "", password = "")
    val rendered = LaunchRenderer.engine(command, ctx)
    val argv = rendered.argv.toMutableList().also { it[oneShot.promptAt] = request.prompt }
    val endpoint = ModelEndpoint(request.baseUrl, request.model, KEY_MARK, request.contextWindow, request.apis)
    val spec = ModelSeam.apply(rendered.copy(argv = argv), wiring, endpoint)
    val envs = if (image) spec.env + ImageLaunch.GUEST_DIRS else spec.env
    val (keyed, plain) = envs.entries.partition { KEY_MARK in it.value }
    val paths = if (image) {
      RuntimeBinding.paths(RuntimeBinding.bind(manifest, KitFolders.runtimes(request.runtimes)), ImageLaunch.GUEST_HOME)
    } else {
      emptyList()
    }

    out.println(
      buildJsonObject {
        put("kind", id)
        put("type", manifest.type)
        put("api", wiring.api)
        put("argv", JsonArray(spec.argv.map(::JsonPrimitive)))
        put("cwd", spec.cwd ?: home.path)
        put("path", JsonArray(paths.map(::JsonPrimitive)))
        put("env", buildJsonObject { plain.forEach { put(it.key, it.value) } })
        put("keyEnv", buildJsonObject { keyed.forEach { put(it.key, it.value) } })
        put("key", request.keyEnv)
      },
    )
    err.println("kit-cli: $id over ${wiring.api}: ${spec.argv.size} args, ${plain.size} env, ${keyed.size} with the key")
    return 0
  }

  private const val TYPE_IMAGE = "image"
}
