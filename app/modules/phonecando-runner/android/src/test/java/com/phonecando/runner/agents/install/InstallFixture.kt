package com.phonecando.runner.agents.install

import com.phonecando.agents.builtin.BuiltinHooks
import com.phonecando.runner.agents.AgentStore
import com.phonecando.runner.agents.AssetTree
import com.phonecando.runner.agents.KindCatalog
import com.phonecando.runner.agents.RuntimeCatalog
import java.io.File
import java.io.InputStream

// A folder laid out as the APK's assets, with an image kind that installs
// (demo: node>=20, apt or apk packages, a step and a version check), one
// that does not (plain), and a node runtime plugin; and an agent store.
class InstallFixture(private val root: File) {
  val tree = object : AssetTree {
    override fun list(path: String): List<String>? {
      val f = File(root, path)
      return if (f.isDirectory) f.list()?.sorted() else emptyList()
    }

    override fun open(path: String): InputStream = File(root, path).inputStream()
  }

  val store = AgentStore(File(root, "state/agents.json"))

  fun write(path: String, text: String) {
    File(root, path).apply { parentFile.mkdirs() }.writeText(text)
  }

  fun runtimes(skipped: (String, Exception) -> Unit = { f, e -> throw AssertionError("runtime $f: ${e.message}", e) }) =
    RuntimeCatalog.load(tree, skipped)

  fun kinds(skipped: (String, Exception) -> Unit = { f, e -> throw AssertionError("kind $f: ${e.message}", e) }) =
    KindCatalog.load(tree, null, BuiltinHooks.all, runtimes(), skipped)

  init {
    write(
      "agents/runtimes/node/runtime.json",
      """{"schema":1,"id":"node","label":"Node.js","provides":22,"families":["apt","apk","dnf"],
         "install":{"apk":"install/apk.sh","*":"install/glibc.sh"},"paths":["{{home}}/.local/opt/node/bin"],
         "check":{"argv":["node","--version"],"pattern":"^v(\\d+)\\."}}""",
    )
    write("agents/runtimes/node/install/apk.sh", "apk add nodejs npm\n")
    write("agents/runtimes/node/install/glibc.sh", "echo fetch node\n")
    write("agents/demo/agent.json", kind("demo", INSTALL))
    write("agents/plain/agent.json", kind("plain", ""))
  }

  companion object {
    val INSTALL = """,
      "install":{"families":["apt","apk","pacman"],"packages":{"apt":["git"],"apk":["git"]},"steps":["npm i -g --prefix \"${'$'}HOME/.local\" demo"]},
      "update":{"steps":["npm i -g --prefix \"${'$'}HOME/.local\" demo@latest"]},
      "versionCheck":{"argv":["{{home}}/.local/bin/demo","--version"],"pattern":"demo (\\d+\\.\\d+\\.\\d+)"}"""

    fun kind(id: String, install: String, runtimes: String = if (install.isEmpty()) "" else "\"node>=20\"") =
      """{"schema":1,"id":"$id","label":"${id.replaceFirstChar(Char::uppercase)}","version":"1","type":"image","channels":["full","lite"],
         "stability":"preview","requires":{"linux":"required","runtimes":[$runtimes]},
         "engine":{"style":"tui","launch":{"argv":["$id"]}}$install}"""
  }
}
