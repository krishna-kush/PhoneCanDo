package com.phonecando.runner.agents

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.io.IOException
import java.nio.file.Files

// JVM checks for AgentStore: records survive a fresh read, secrets are long
// unique hex, the token finds its agent, and a write is all or nothing.
class AgentStoreTest {
  private val root = Files.createTempDirectory("agents").toFile()
  private val file = File(File(root, "state"), "agents.json")
  private var now = 1_000L
  private fun store() = AgentStore(file, clock = { now })

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun createdAgentsSurviveAFreshRead() {
    val s = store()
    val a = s.create("opencode", "  Main  ", "img1")
    now = 2_000L
    val b = s.create("opencode", "Second", "img2")
    val again = store().all()
    assertEquals(listOf(a, b), again)
    assertEquals("Main", a.name)
    assertEquals(1_000L, a.createdAt)
    assertNull(a.port)
  }

  @Test fun secretsAreLongUniqueHex() {
    val s = store()
    val agents = (1..20).map { s.create("opencode", "a$it", "img$it") }
    val hex = Regex("[0-9a-f]+")
    for (a in agents) {
      assertTrue(a.password.length >= 32 && hex.matches(a.password))
      assertTrue(a.bridgeToken.length >= 32 && hex.matches(a.bridgeToken))
      assertNotEquals(a.password, a.bridgeToken)
    }
    assertEquals(20, agents.map { it.id }.toSet().size)
    assertEquals(20, agents.map { it.bridgeToken }.toSet().size)
    assertEquals(20, agents.map { it.password }.toSet().size)
  }

  @Test fun bridgeTokenFindsItsAgent() {
    val s = store()
    val a = s.create("opencode", "A", "i1")
    val b = s.create("opencode", "B", "i2")
    assertEquals(a, s.byBridgeToken(a.bridgeToken))
    assertEquals(b, store().byBridgeToken(b.bridgeToken))
    assertNull(s.byBridgeToken(""))
    assertNull(s.byBridgeToken(a.password))
    assertNull(s.byBridgeToken(a.bridgeToken.dropLast(1)))
  }

  @Test fun renameDeleteAndPort() {
    val s = store()
    val a = s.create("opencode", "A", "i1")
    assertEquals("Renamed", s.rename(a.id, " Renamed ").name)
    s.setPort(a.id, "40123")
    assertEquals("40123", store().get(a.id)?.port)
    assertTrue(s.delete(a.id))
    assertFalse(s.delete(a.id))
    assertEquals(emptyList<AgentRecord>(), store().all())
  }

  @Test fun aFirstRunIsKept() {
    val s = store()
    val a = s.create("user.top", "top", "i1")
    assertFalse(a.ranBefore)
    s.markRan(a.id)
    s.markRan(a.id)
    s.markRan("nope")
    assertTrue(store().get(a.id)!!.ranBefore)
  }

  @Test fun wakeableIsOnUntilSwitchedOffAndKept() {
    val s = store()
    val a = s.create("opencode", "A", "i1")
    assertTrue(a.wakeable)
    assertFalse(s.setWakeable(a.id, false).wakeable)
    assertFalse(store().get(a.id)!!.wakeable)
    assertTrue(s.setWakeable(a.id, true).wakeable)
    // A record without the field reads as on.
    val bare = JSONObject(file.readText())
    bare.getJSONArray("agents").getJSONObject(0).remove("wakeable")
    file.writeText(bare.toString())
    assertTrue(store().get(a.id)!!.wakeable)
  }

  @Test fun anInstalledVersionIsKept() {
    val s = store()
    val a = s.create("user.gemini", "Gemini", "i1")
    assertNull(a.installedVersion)
    assertEquals("0.9.1", s.setInstalledVersion(a.id, "0.9.1").installedVersion)
    assertEquals("0.10.0", s.setInstalledVersion(a.id, "0.10.0").installedVersion)
    assertEquals("0.10.0", store().get(a.id)!!.installedVersion)
    // A record without the field reads as nothing installed.
    val old = JSONObject(file.readText())
    old.getJSONArray("agents").getJSONObject(0).remove("installedVersion")
    file.writeText(old.toString())
    assertNull(store().get(a.id)!!.installedVersion)
  }

  @Test fun aLocalModelIsKept() {
    val s = store()
    val a = s.create("opencode", "Main", "img1")
    assertNull(a.model)
    assertEquals("qwen3-5-4b-q4-k-m", s.setModel(a.id, "qwen3-5-4b-q4-k-m").model)
    assertEquals("qwen3-5-4b-q4-k-m", store().get(a.id)!!.model)
    assertNull(s.setModel(a.id, null).model)
    assertNull(store().get(a.id)!!.model)
  }

  @Test fun rejectsBadInput() {
    val s = store()
    for (id in listOf("", ".", "..", "a/b", "../x", "a b", "x".repeat(49))) {
      try {
        s.create("opencode", "A", id)
        fail("image id '$id' was accepted")
      } catch (_: IllegalArgumentException) {
      }
    }
    try {
      s.create("opencode", "   ", "img")
      fail("empty name was accepted")
    } catch (_: IllegalArgumentException) {
    }
    assertEquals(emptyList<AgentRecord>(), s.all())
  }

  @Test fun writeReplacesTheFileWhole() {
    val s = store()
    s.create("opencode", "A", "i1")
    assertFalse(File(file.parentFile, "agents.json.tmp").exists())
    val before = file.readText()
    // The temp file cannot be written: the change fails and the old list stays.
    File(file.parentFile, "agents.json.tmp").mkdirs()
    try {
      s.create("opencode", "B", "i2")
      fail("write into a folder succeeded")
    } catch (_: IOException) {
    }
    assertEquals(before, file.readText())
    assertEquals(1, s.all().size)
    assertEquals(1, store().all().size)
  }

  @Test fun unreadableFileIsNoAgents() {
    file.parentFile.mkdirs()
    file.writeText("{not json")
    val s = store()
    assertEquals(emptyList<AgentRecord>(), s.all())
    s.create("opencode", "A", "i1")
    assertEquals(1, store().all().size)
  }

  @Test fun aSecondAgentOfAKindKeepsItsOwnState() {
    val s = store()
    val first = s.create("user.claude", "One", "m1", ownStateSupported = true)
    assertFalse(first.ownState)
    // Another kind on the machine, or the kind on another machine, shares nothing.
    assertFalse(s.create("opencode", "Other", "m1").ownState)
    assertFalse(s.create("user.claude", "Elsewhere", "m2", ownStateSupported = true).ownState)
    val second = s.create("user.claude", "Two", "m1", ownStateSupported = true)
    assertTrue(second.ownState)
    assertTrue(store().get(second.id)!!.ownState)
    assertFalse(store().get(first.id)!!.ownState)
    assertEquals(listOf(first.id, s.all()[1].id, second.id), s.onMachine("m1").map { it.id })
    // A record without the field keeps the kind's state.
    val old = JSONObject(file.readText())
    old.getJSONArray("agents").getJSONObject(3).remove("ownState")
    file.writeText(old.toString())
    assertFalse(store().get(second.id)!!.ownState)
  }

  @Test fun aKindThatCannotKeepItsOwnStateIsRefusedASecondAgent() {
    val s = store()
    s.create("user.top", "One", "m1")
    try {
      s.create("user.top", "Two", "m1")
      fail("a second agent of a kind that cannot share was made")
    } catch (e: KindCannotShare) {
      assertEquals("user.top", e.kind)
      assertTrue(e.message!!.startsWith("kind_cannot_share: "))
    }
    assertEquals(1, store().all().size)
    // Its own machine, or a kind that can, is fine.
    s.create("user.top", "Two", "m2")
    s.create("opencode", "Three", "m1")
    assertEquals(3, store().all().size)
  }

  @Test fun theKindsInstallIsOnePerMachine() {
    val s = store()
    val a = s.create("user.claude", "A", "m1", ownStateSupported = true)
    val elsewhere = s.create("user.claude", "Elsewhere", "m2", ownStateSupported = true)
    val other = s.create("user.gemini", "Other", "m1")
    assertEquals("1.0.0", s.setInstalledVersion(a.id, "1.0.0").installedVersion)
    // A second agent there starts with the install the first has.
    val b = s.create("user.claude", "B", "m1", ownStateSupported = true)
    assertEquals("1.0.0", b.installedVersion)
    // An update by either reaches both, and no other kind or machine.
    assertEquals("1.1.0", s.setInstalledVersion(b.id, "1.1.0").installedVersion)
    val again = store()
    assertEquals("1.1.0", again.get(a.id)!!.installedVersion)
    assertEquals("1.1.0", again.get(b.id)!!.installedVersion)
    assertNull(again.get(elsewhere.id)!!.installedVersion)
    assertNull(again.get(other.id)!!.installedVersion)
    try {
      s.setInstalledVersion("nope", "1")
      fail("an unknown agent got a version")
    } catch (_: IllegalArgumentException) {
    }
  }
}
