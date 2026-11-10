package com.phonecando.runner.agents

import com.phonecando.agents.builtin.BuiltinHooks
import com.phonecando.agents.kit.AgentConfig
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.agents.kit.render.KindView
import com.phonecando.runner.agents.user.UserKindRules
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import java.io.File
import java.io.InputStream
import java.nio.file.Files

// JVM checks for KindCatalog: the repo's kinds load with their hooks, the
// user's kinds load after them, and a kind that cannot load is left out
// without taking the others down.
class KindCatalogTest {
  private val root = Files.createTempDirectory("kinds").toFile()

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun theRepoKindsLoad() {
    val catalog = TestKinds.catalog
    val opencode = checkNotNull(catalog.get("opencode"))
    assertSame(opencode, catalog.default)
    // Every repo kind loads, with the repo's runtimes.
    assertEquals(TestKinds.assets.list("agents")!!.filter { it !in KindCatalog.NOT_KINDS }, catalog.all().map { it.id })
    // What ConfigSeeder got from the old OpencodeKind, so HOME stays as it was.
    assertEquals(AgentConfig("agents/opencode/config", ".config/opencode", setOf("opencode.json"), "AGENTS.md"), opencode.config)
    assertNull(catalog.get("nope"))
  }

  @Test fun theKindViewCarriesTheAdapterVerbatim() {
    val catalog = TestKinds.catalog
    val views = Json.parseToJsonElement(KindView.list(catalog.all(), "opencode") { true }) as JsonArray
    val view = views.map { it.jsonObject }.single { it["id"].toString() == "\"opencode\"" }
    val manifest = Json.parseToJsonElement(TestKinds.assets.open("agents/opencode/agent.json").use { it.reader().readText() }).jsonObject
    val adapter = manifest["surfaces"]!!.jsonObject["web"]!!.jsonObject["adapter"]
    assertEquals(adapter, view["web"]!!.jsonObject["adapter"])
    assertEquals(adapter.toString(), view["web"]!!.jsonObject["adapter"].toString())
    assertEquals("true", view["isDefault"].toString())
    assertEquals("\"web\"", view["home"].toString())
    assertEquals("\"bundled\"", view["origin"].toString())
    assertEquals("true", view["payloadPresent"].toString())
    val missing = Json.parseToJsonElement(KindView.list(catalog.all(), "opencode") { it != "liboc-opentui.so" }) as JsonArray
    assertEquals("false", missing.map { it.jsonObject }.single { it["id"].toString() == "\"opencode\"" }["payloadPresent"].toString())
  }

  private val noRuntimes = RuntimeCatalog(emptyList())

  // A folder as the APK assets: agents/<folder>/agent.json.
  private val tree = object : AssetTree {
    override fun list(path: String): List<String>? {
      val f = File(root, path)
      return if (f.isDirectory) f.list()?.sorted() else emptyList()
    }

    override fun open(path: String): InputStream = File(root, path).inputStream()
  }

  private fun kind(folder: String, json: String) {
    File(root, "agents/$folder").mkdirs()
    File(root, "agents/$folder/agent.json").writeText(json)
  }

  @Test fun aKindThatCannotLoadIsLeftOut() {
    val good = TestKinds.assets.open("agents/opencode/agent.json").use { it.reader().readText() }
    kind("opencode", good)
    kind("broken", "{")
    kind("moved", good)
    kind("hookless", good.replace("\"id\": \"opencode\"", "\"id\": \"hookless\""))
    kind("empty", "")
    File(root, "agents/nofile").mkdirs()
    // Packaged beside the kinds, and no kind.
    for (folder in KindCatalog.NOT_KINDS) File(root, "agents/$folder/x").mkdirs()
    val skipped = mutableListOf<String>()
    val catalog = KindCatalog.load(tree, null, BuiltinHooks.all, noRuntimes, BuiltinHooks.defaultKindId) { folder, _ -> skipped += folder }
    assertEquals(listOf("opencode"), catalog.all().map { it.id })
    assertEquals(listOf("broken", "empty", "hookless", "moved", "nofile"), skipped)
  }

  @Test fun noKindsAtAll() {
    val catalog = KindCatalog.load(tree, File(root, "missing"), BuiltinHooks.all, noRuntimes, BuiltinHooks.defaultKindId) { _, e -> throw e }
    assertEquals(emptyList<Any>(), catalog.all())
    assertNull(catalog.default)
  }

  private val users = File(root, "user")

  private fun user(file: String, json: String) {
    users.mkdirs()
    File(users, file).writeText(json)
  }

  private fun userKind(id: String, extra: String = "") =
    """{"schema":1,"id":"$id","label":"top","version":"1","type":"image","channels":["full","lite"],"stability":"preview",
       "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["top"]}$extra}}"""

  @Test fun theUsersKindsLoadAfterTheBundledOnes() {
    kind("opencode", TestKinds.assets.open("agents/opencode/agent.json").use { it.reader().readText() })
    user("user.top.json", userKind("user.top", ""","readiness":{"alive":{"ms":500}}"""))
    user("user.htop.json", userKind("user.htop"))
    user("notes.txt", "not a manifest")
    val catalog = KindCatalog.load(tree, users, BuiltinHooks.all, noRuntimes, BuiltinHooks.defaultKindId) { _, e -> throw e }
    assertEquals(listOf("opencode", "user.htop", "user.top"), catalog.all().map { it.id })
    assertEquals(Origin.USER, catalog.get("user.top")!!.manifest.origin)
    assertSame(catalog.get("opencode"), catalog.default)
    val view = (Json.parseToJsonElement(KindView.list(catalog.all(), "opencode") { false }) as JsonArray)[2].jsonObject
    assertEquals(listOf("\"user\"", "true", "true"), listOf("origin", "requiresLinux", "payloadPresent").map { view[it].toString() })
  }

  @Test fun aBadUserKindIsLeftOutAndNamed() {
    user("user.good.json", userKind("user.good"))
    user("user.broken.json", "{")
    user("user.moved.json", userKind("user.other"))
    user("user.server.json", userKind("user.server").replace("\"tui\"", "\"server\""))
    user("user.hooked.json", userKind("user.hooked").replace("\"schema\":1,", "\"schema\":1,\"hooks\":[\"user.hooked.events\"],"))
    user("user.huge.json", userKind("user.huge").replace("\"label\":\"top\"", "\"label\":\"${"x".repeat(UserKindRules.MAX_BYTES)}\""))
    user("plain.json", userKind("plain"))
    File(users, "user.dir.json").mkdirs()
    val skipped = mutableMapOf<String, String?>()
    val catalog = KindCatalog.load(tree, users, BuiltinHooks.all, noRuntimes, BuiltinHooks.defaultKindId) { folder, e -> skipped[folder] = e.message }
    assertEquals(listOf("user.good"), catalog.all().map { it.id })
    assertEquals(
      listOf("user/plain.json", "user/user.broken.json", "user/user.dir.json", "user/user.hooked.json", "user/user.huge.json", "user/user.moved.json", "user/user.server.json"),
      skipped.keys.sorted(),
    )
    assertEquals("/id: a user kind's id starts with user.", skipped["user/plain.json"])
    assertEquals("its id is user.other", skipped["user/user.moved.json"])
    assertEquals("/hooks: a user kind has none", skipped["user/user.hooked.json"])
  }
}
