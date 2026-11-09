package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.PtyEvent
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// A kind bound to its runtimes: what bind() refuses, the families that
// follow, the paths on the engine's PATH, and what ManifestKind exposes for
// the runner (install, update, version check, hook events, KindView).
class RuntimeBindingTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))
  private val node = Runtimes.node(fixtures)

  private fun py(families: String) =
    Runtimes.plugin(""""id":"py","provides":3,"families":[$families],"paths":["/opt/py/bin"],"check":{"argv":["python3","-V"],"pattern":"(\\d+)"}""", "")

  private val needsBoth = Runtimes.kind(""""install":{},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""", "\"node>=20\",\"py\"")

  @Test fun bindsWhatTheCatalogHas() {
    val bound = RuntimeBinding.bind(needsBoth, mapOf("node" to node, "py" to py("\"apt\"")))
    assertEquals(listOf("node" to 20, "py" to null), bound.map { it.plugin.id to it.atLeast })
    assertEquals(
      "demo: needs runtime py, which this build does not have",
      assertFailsWith<KindException> { RuntimeBinding.bind(needsBoth, mapOf("node" to node)) }.message,
    )
    val tooNew = Runtimes.kind(""""install":{},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""", "\"node>=24\"")
    assertEquals(
      "demo: needs node>=24, and its plugin provides 22",
      assertFailsWith<KindException> { RuntimeBinding.bind(tooNew, mapOf("node" to node)) }.message,
    )
  }

  @Test fun familiesNarrowToEveryRuntimes() {
    val bound = RuntimeBinding.bind(needsBoth, mapOf("node" to node, "py" to py("\"apk\",\"apt\"")))
    assertEquals(listOf("apt", "apk"), RuntimeBinding.families(needsBoth, bound), "in the kind's order (all families, lre's order)")
    val own = needsBoth.copy(install = needsBoth.install!!.copy(families = listOf("apk", "dnf")))
    assertEquals(listOf("apk"), RuntimeBinding.families(own, bound))
    assertNull(RuntimeBinding.families(Runtimes.kind(""""install":{},"versionCheck":{"argv":["d"],"pattern":"(.+)"}"""), emptyList()))
  }

  @Test fun theEngineFindsItsRuntimes() {
    val kind = ManifestKind.of(needsBoth, null, mapOf("node" to node, "py" to py("\"apt\"")))
    val ctx = LaunchContext("/lib", File("/i/home"), File("/i/tmp"), "", "pw", image = File("/i"))
    assertEquals(
      listOf("/i/shims/sh", "-c", "cd '/root' || exit; PATH='/root/.local/opt/node/bin:/opt/py/bin':\$PATH; export PATH; exec \"\$0\" \"\$@\"", "demo"),
      kind.launch(ctx).argv,
    )
    assertEquals(listOf("node", "py"), kind.runtimes.map { it.plugin.id })
    assertEquals(listOf("apt"), kind.families)
    val view = KindView.of(kind, false) { true }
    assertEquals(listOf("[\"apt\"]", "[\"node\",\"py\"]", "true"), listOf("families", "runtimes", "hasInstall").map { view[it].toString() })
    assertFailsWith<KindException> { ManifestKind.of(needsBoth, null) }
  }

  @Test fun theRunnersInstallSurface() {
    val gemini = ManifestKind.of(
      com.phonecando.agents.kit.manifest.ManifestDecoder.decode(File(fixtures, "valid/gemini-cli.json").readText()),
      null,
      Runtimes.catalog(fixtures),
    )
    assertTrue(gemini.hasInstall)
    assertEquals(listOf("runtime:node", "packages", "install", "verify"), gemini.installPlan("apk")!!.phases)
    assertEquals(listOf("runtime:node", "update", "verify"), gemini.updatePlan("apk")!!.phases)
    assertFailsWith<NoRecipe> { gemini.installPlan("xbps") }
    assertEquals(listOf("/root/.local/bin/gemini", "--version"), gemini.versionCheck("/root")!!.argv)
    assertEquals("0.12.0", gemini.parseVersion("gemini 0.12.0\n"))
    assertEquals(emptyList(), gemini.guestUnset)
    assertEquals(
      mapOf("AfterAgent" to PtyEvent.FINISHED, "Notification" to PtyEvent.WAITING, "BeforeAgent" to PtyEvent.WORKING),
      gemini.hookEvents,
    )
    val top = ManifestKind.of(Runtimes.kind(""""surfaces":{"home":"tui"}"""), null)
    assertEquals(listOf(false, null, null, null), listOf(top.hasInstall, top.installPlan("apt"), top.versionCheck("/root"), top.parseVersion("1")))
  }

  @Test fun refusesAnInstallTheHostCannotCheck() {
    assertEquals(
      "demo: an install needs a versionCheck",
      assertFailsWith<KindException> { ManifestKind.of(Runtimes.kind(""""install":{}"""), null) }.message,
    )
    assertEquals(
      "demo: requires.runtimes need an install",
      assertFailsWith<KindException> { ManifestKind.of(Runtimes.kind(""""surfaces":{"home":"tui"}""", "\"node\""), null) }.message,
    )
    assertTrue(
      "does not compile" in assertFailsWith<KindException> {
        ManifestKind.of(Runtimes.kind(""""install":{},"versionCheck":{"argv":["d"],"pattern":"(x"}"""), null)
      }.message!!,
    )
  }
}
