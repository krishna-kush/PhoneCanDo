package com.phonecando.runner.agents.install

import com.phonecando.agents.kit.render.KindView
import com.phonecando.runner.agents.KindCatalog
import com.phonecando.runner.agents.TestKinds
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for installing an agent's kind into its image: the start
// check, the plans and the version check JS runs, the record of the
// installed version, and the kinds bound to the runtimes they need.
class AgentInstallsTest {
  private val root = Files.createTempDirectory("install").toFile()
  private val fx = InstallFixture(root)
  private val kinds = fx.kinds()
  private val installs = AgentInstalls(fx.store, kinds)
  private val demo = fx.store.create("demo", "Demo", "img1")
  private val home = AgentInstalls.GUEST_HOME

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun theStartWaitsForTheInstall() {
    val kind = kinds.get("demo")!!
    assertTrue(InstallGate.needsInstall(kind, demo))
    try {
      InstallGate.check(kind, demo)
      fail("an agent that is not installed started")
    } catch (e: EngineStartException) {
      assertEquals(EngineStartError.AGENT_NOT_INSTALLED, e.error)
      assertTrue(e.message!!.startsWith("agent_not_installed: "))
    }
    installs.recordInstall(demo.id, "demo 1.2.3\n")
    InstallGate.check(kind, fx.store.get(demo.id)!!)
    // A kind without an install starts as before.
    val plain = fx.store.create("plain", "Plain", "img2")
    assertFalse(InstallGate.needsInstall(kinds.get("plain")!!, plain))
    InstallGate.check(kinds.get("plain")!!, plain)
  }

  @Test fun recordInstallKeepsTheVersionOrRefuses() {
    assertEquals("1.2.3", installs.recordInstall(demo.id, "Welcome\ndemo 1.2.3 (linux-arm64)\n"))
    assertEquals("1.2.3", fx.store.get(demo.id)!!.installedVersion)
    try {
      installs.recordInstall(demo.id, "command not found")
      fail("no version was recorded")
    } catch (e: InstallException) {
      assertEquals(InstallError.VERIFY_FAILED, e.error)
      assertTrue(e.message!!.startsWith("verify_failed: "))
    }
    // The last good version stays.
    assertEquals("1.2.3", fx.store.get(demo.id)!!.installedVersion)
    // A kind without a check records that it ran.
    val plain = fx.store.create("plain", "Plain", "img2")
    assertEquals(AgentInstalls.NO_CHECK, installs.recordInstall(plain.id, ""))
  }

  @Test fun plansForTheImagesFamily() {
    val plan = installs.installPlan(demo.id, "apk")!!
    assertEquals(listOf("runtime:node", "packages", "install", "verify"), plan.phases)
    assertTrue(plan.script, "apk add nodejs npm" in plan.script)
    assertTrue(plan.script, "/.local/opt/node/bin" in plan.script)
    assertEquals(listOf("runtime:node", "update", "verify"), installs.updatePlan(demo.id, "apt")!!.phases)
    val plain = fx.store.create("plain", "Plain", "img2")
    assertNull(installs.installPlan(plain.id, "apt"))
    assertNull(installs.updatePlan(plain.id, "apt"))
  }

  @Test fun anUnsupportedFamilyHasNoRecipe() {
    // pacman: the kind names it, node does not; "": a family we do not know.
    for (family in listOf("pacman", "xbps", "")) {
      try {
        installs.installPlan(demo.id, family)
        fail("$family got a plan")
      } catch (e: InstallException) {
        assertEquals(InstallError.NO_RECIPE, e.error)
        assertTrue(e.message!!.startsWith("no_recipe: "))
      }
    }
  }

  @Test fun theVersionCheckRunsWithTheRuntimesOnPath() {
    val check = installs.versionCheck(demo.id)!!
    assertEquals("sh", check.argv[0])
    assertEquals("-c", check.argv[1])
    assertEquals("PATH='$home/.local/opt/node/bin':\$PATH; export PATH; exec \"\$0\" \"\$@\" 2>&1", check.argv[2])
    assertEquals(listOf("$home/.local/bin/demo", "--version"), check.argv.drop(3))
    assertEquals("demo (\\d+\\.\\d+\\.\\d+)", check.pattern)
    assertNull(installs.versionCheck(fx.store.create("plain", "Plain", "img2").id))
  }

  @Test fun anImageKindKeepsItsEnvInTheImage() {
    assertEquals(emptyList<String>(), installs.guestUnset(demo.id))
  }

  @Test fun theMachineUnsetsWhatAnyOfItsAgentsKindKeeps() {
    // The repo's kinds: opencode is native and keeps its bridge and
    // secrets from guests; an image kind keeps nothing.
    val repo = AgentInstalls(fx.store, TestKinds.catalog)
    val opencode = TestKinds.catalog.get("opencode")!!.guestUnset
    assertTrue(opencode.isNotEmpty())
    val image = TestKinds.catalog.all().first { it.manifest.type == "image" }
    val guest = fx.store.create(image.id, "Guest", "m1")
    assertEquals(emptyList<String>(), repo.guestUnset(guest.id))
    val oc = fx.store.create("opencode", "Oc", "m1")
    val oc2 = fx.store.create("opencode", "Oc 2", "m1", ownStateSupported = true)
    // The same list whichever agent asks, each name once.
    assertEquals(opencode, repo.guestUnset(guest.id))
    assertEquals(opencode, repo.guestUnset(oc.id))
    assertEquals(opencode, repo.guestUnset(oc2.id))
    // Another machine, and a kind this build lacks (demo here), add nothing.
    assertEquals(emptyList<String>(), repo.machineUnset("img1"))
    assertEquals(emptyList<String>(), repo.guestUnset(fx.store.create(image.id, "Apart", "m2").id))
  }

  @Test fun anInstallServesEveryAgentOfTheKindOnTheMachine() {
    val mate = fx.store.create("demo", "Demo 2", "img1", ownStateSupported = true)
    assertTrue(mate.ownState)
    installs.recordInstall(mate.id, "demo 2.0.0\n")
    assertEquals("2.0.0", fx.store.get(demo.id)!!.installedVersion)
    InstallGate.check(kinds.get("demo")!!, fx.store.get(demo.id)!!)
    // A third agent there starts installed.
    assertEquals("2.0.0", fx.store.create("demo", "Demo 3", "img1", ownStateSupported = true).installedVersion)
  }

  @Test fun kindsBindToTheRuntimesTheyNeed() {
    val view = (Json.parseToJsonElement(KindView.list(kinds.all(), "plain") { true }) as JsonArray)
      .map { it.jsonObject }.single { it["id"].toString() == "\"demo\"" }
    assertEquals("[\"node\"]", view["runtimes"].toString())
    assertEquals("true", view["hasInstall"].toString())
    // Its own families cut down to node's.
    assertEquals("[\"apt\",\"apk\"]", view["families"].toString())
    // A kind that needs a runtime this build lacks, or a newer one, is left out.
    fx.write("agents/needsruby/agent.json", InstallFixture.kind("needsruby", InstallFixture.INSTALL, "\"ruby\""))
    fx.write("agents/needsnode30/agent.json", InstallFixture.kind("needsnode30", InstallFixture.INSTALL, "\"node>=30\""))
    val skipped = mutableListOf<String>()
    val again = KindCatalog.load(fx.tree, null, emptyMap(), fx.runtimes()) { folder, _ -> skipped += folder }
    assertEquals(listOf("demo", "plain"), again.all().map { it.id })
    assertEquals(listOf("needsnode30", "needsruby"), skipped)
  }

  @Test fun aRuntimeThatCannotLoadIsLeftOut() {
    fx.write("agents/runtimes/moved/runtime.json", File(root, "agents/runtimes/node/runtime.json").readText())
    fx.write("agents/runtimes/broken/runtime.json", "{")
    val skipped = mutableListOf<String>()
    val runtimes = fx.runtimes { folder, _ -> skipped += folder }
    assertEquals(setOf("node"), runtimes.byId.keys)
    assertEquals(listOf("broken", "moved"), skipped)
    assertEquals("echo fetch node\n", runtimes.byId.getValue("node").script("apt"))
  }
}
