package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

// agent.json text -> Manifest. Strict about the structure and types of every
// field it reads (a wrong one throws ManifestException naming its JSON
// pointer) and blind to the fields it does not read. The full rules (ids,
// patterns, placeholders, which blocks a style needs…) are the kit's TS
// validator's, which CI runs on every manifest we ship. A user's manifest
// never went through CI, so it also gets the user rules here (UserRules).
object ManifestDecoder {
  const val SCHEMA = 1

  // What an engine's idle rule may watch (`idle.from`).
  private val IDLE_SOURCES = listOf("events", "output")

  // How a web pairing request is sent (`surfaces.web.pair.method`), with an empty body.
  private val PAIR_METHODS = listOf("POST")

  fun decode(text: String, origin: Origin = Origin.BUNDLED): Manifest {
    val m = JsonFields.parse(text)
    if (m.int("schema") != SCHEMA) throw ManifestException(m.at("schema"), "must be $SCHEMA")
    val manifest = Manifest(
      origin = origin,
      id = m.string("id"),
      label = m.string("label"),
      version = m.string("version"),
      type = m.string("type"),
      channels = m.strings("channels"),
      stability = m.string("stability"),
      isDefault = m.optBoolean("default") ?: false,
      payloadLibs = m.optObj("payload")?.let(::payloadLibs).orEmpty(),
      linux = m.optObj("requires")?.takeIf { it.has("linux") }?.let { enumOf(it, "linux", LinuxNeed.entries) { need -> need.wire } },
      commands = m.optObj("requires")?.optStrings("commands").orEmpty(),
      runtimes = m.optObj("requires")?.let(InstallDecoder::runtimes).orEmpty(),
      install = m.optObj("install")?.let(InstallDecoder::install),
      update = m.optObj("update")?.let(InstallDecoder::update),
      versionCheck = m.optObj("versionCheck")?.let(InstallDecoder::versionCheck),
      config = m.optObj("config")?.let(::config),
      engine = m.optObj("engine")?.let(::engine),
      events = m.optArray("events")?.let { events(m.at("events"), it) }.orEmpty(),
      chats = m.optObj("chats")?.let(::chats),
      idle = m.optObj("idle")?.let { Idle(oneOf(it, "from", IDLE_SOURCES), it.int("quietSec")) },
      surfaces = m.optObj("surfaces")?.let(::surfaces),
      phoneTools = if (m.has("phoneTools")) enumOf(m, "phoneTools", PhoneTools.entries) { it.wire } else null,
      signIn = m.optArray("signIn") ?: JsonArray(emptyList()),
      hooks = m.optStrings("hooks"),
      models = m.optObj("models")?.let(::models).orEmpty(),
    )
    if (origin == Origin.USER) UserRules.check(m, manifest)
    return manifest
  }

  // One wiring per API, in manifest order: the kind's preference.
  private fun models(ms: JsonFields): List<ModelWiring> = ms.tree.keys.map { api ->
    if (api !in ModelWiring.APIS) throw ManifestException(ms.at(api), "must be one of ${ModelWiring.APIS.joinToString()}")
    val w = ms.obj(api)
    ModelWiring(api, w.stringMap("env"), w.optStrings("args"))
  }

  private fun payloadLibs(p: JsonFields): List<String> {
    val libs = p.array("libs")
    return libs.mapIndexed { i, lib -> JsonFields.of("${p.at("libs")}/$i", lib).string("name") }
  }

  private fun config(c: JsonFields) = Config(
    into = c.string("into"),
    keep = c.optStrings("keep"),
    instructions = c.optString("instructions"),
  )

  private fun engine(e: JsonFields) = Engine(
    style = enumOf(e, "style", EngineStyle.entries) { it.wire },
    launch = e.optObj("launch")?.let(::command),
    auth = e.optObj("auth")?.let { a -> Auth(a.optObj("basic")?.let { BasicAuth(it.string("user")) }) },
    readiness = e.optObj("readiness")?.let(::readiness),
    resume = e.optObj("resume")?.let { r -> Resume(r.strings("args"), r.optInt("at")) },
  )

  private fun readiness(r: JsonFields) = Readiness(
    http = r.optObj("http")?.let { HttpPath(it.string("path")) },
    output = r.optObj("output")?.let { OutputReadiness(it.optInt("settleMs"), it.optInt("timeoutSec")) },
    alive = r.optObj("alive")?.let { AliveReadiness(it.optInt("ms")) },
  )

  private fun command(c: JsonFields) = Command(
    argv = argv(c.at("argv"), c.array("argv")),
    env = c.stringMap("env"),
    cwd = c.optString("cwd"),
  )

  // Each item is a string, or {"when": "<placeholder>", "args": [...]}.
  private fun argv(path: String, items: JsonArray): List<ArgvItem> = items.mapIndexed { i, item ->
    if (item is JsonObject) {
      val w = JsonFields.of("$path/$i", item)
      ArgvItem.When(w.string("when"), w.strings("args"))
    } else {
      ArgvItem.Text(JsonFields.asString("$path/$i", item))
    }
  }

  private fun events(path: String, items: JsonArray): List<EventSource> = items.mapIndexed { i, item ->
    val e = JsonFields.of("$path/$i", item)
    val sse = e.optObj("sse")
    val pty = e.optObj("pty")
    val hook = e.optObj("hook")
    when {
      sse != null -> EventSource.Sse(sse.string("path"), sse.string("parser"))
      pty != null -> EventSource.Pty(ptyRules(pty))
      hook != null -> EventSource.Hook(hookMap(hook.obj("map")))
      else -> throw ManifestException(e.path, "is no event source this build reads (sse, pty, hook)")
    }
  }

  private fun hookMap(map: JsonFields): Map<String, PtyEvent> =
    map.tree.keys.associateWithTo(LinkedHashMap()) { name -> enumOf(map, name, PtyEvent.entries) { it.wire } }

  private fun ptyRules(p: JsonFields): List<PtyRule> = p.array("rules").mapIndexed { i, item ->
    val r = JsonFields.of("${p.at("rules")}/$i", item)
    PtyRule(
      on = enumOf(r, "on", PtySignal.entries) { it.wire },
      match = r.optString("match"),
      event = enumOf(r, "event", PtyEvent.entries) { it.wire },
    )
  }

  private fun chats(c: JsonFields) = Chats(
    title = c.optObj("title")?.obj("http")?.let { TitleSource(it.string("path"), it.string("json")) },
  )

  private fun surfaces(s: JsonFields) = Surfaces(
    home = enumOf(s, "home", HomeSurface.entries) { it.wire },
    web = s.optObj("web")?.let { w ->
      WebSurface(
        pair = w.optObj("pair")?.let { p ->
          WebPair(enumOf(p, "method", PAIR_METHODS) { it }, p.string("path"), p.strings("code"), p.string("url"))
        },
        adapter = w.optObj("adapter")?.let(::checkAdapter),
      )
    },
    terminal = s.optObj("terminal")?.let { t ->
      TerminalSurface(client = t.optObj("client")?.let(::command), chatTitle = t.optString("chatTitle"))
    },
    chatTitle = s.optString("chatTitle"),
  )

  // Kept verbatim for the app; only its fields' types are checked here.
  private fun checkAdapter(a: JsonFields): JsonObject {
    a.obj("cssVars")
    a.stringMap("cssVars")
    a.string("authUrl")
    a.optString("colorSchemeKey")
    a.optStrings("hide")
    a.optString("sessionUrl")
    return a.tree
  }

  // An array whose every item is one of [values].
  private fun oneOf(o: JsonFields, key: String, values: List<String>): List<String> =
    o.strings(key).onEachIndexed { i, v ->
      if (v !in values) throw ManifestException("${o.at(key)}/$i", "must be one of ${values.joinToString()}, not $v")
    }

  internal fun <E> enumOf(o: JsonFields, key: String, values: List<E>, wire: (E) -> String): E {
    val value = o.string(key)
    return values.firstOrNull { wire(it) == value }
      ?: throw ManifestException(o.at(key), "must be one of ${values.joinToString { wire(it) }}, not $value")
  }
}
