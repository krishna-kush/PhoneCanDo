package com.phonecando.agents.cline

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.render.RuntimePlugin
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The model Cline's TUI last used, read from a fake providers.json the way
// the phone's 3.0.74 writes it (tokens beside it, never read), and through
// ../agent.json as the runner loads it.
class ChosenModelTest {
  @TempDir lateinit var home: File

  private fun providers(json: String) {
    File(home, ChosenModel.PROVIDERS).apply { parentFile.mkdirs() }.writeText(json)
  }

  private val signedIn = """{
    "version": 1,
    "lastUsedProvider": "cline",
    "providers": {
      "cline": {"settings": {"provider": "cline", "model": "cline-free/solar-mini4", "auth": {"accessToken": "secret-a", "refreshToken": "secret-r"}}},
      "anthropic": {"settings": {"model": "claude-sonnet-5.5", "apiKey": "secret-k"}}
    }
  }"""

  @Test fun theLastUsedProvidersModel() {
    providers(signedIn)
    assertEquals(mapOf("model" to "cline-free/solar-mini4"), ChosenModel.options(home))
    providers(signedIn.replace("\"lastUsedProvider\": \"cline\"", "\"lastUsedProvider\": \"anthropic\""))
    assertEquals(mapOf("model" to "claude-sonnet-5.5"), ChosenModel.options(home))
  }

  @Test fun nothingWithoutAPlainModel() {
    assertTrue(ChosenModel.options(home).isEmpty(), "no file")
    for (json in listOf(
      "not json",
      "[]",
      """{"providers":{"cline":{"settings":{"model":"m"}}}}""",
      """{"lastUsedProvider":"cline","providers":{}}""",
      """{"lastUsedProvider":"cline","providers":{"cline":{"settings":{}}}}""",
      """{"lastUsedProvider":"cline","providers":{"cline":{"settings":{"model":7}}}}""",
      """{"lastUsedProvider":"cline","providers":{"cline":{"settings":{"model":"a b; rm -rf /"}}}}""",
      """{"lastUsedProvider":"cline","providers":{"cline":{"settings":{"model":""}}}}""",
      """{"lastUsedProvider":{"id":"cline"},"providers":{"cline":{"settings":{"model":"m"}}}}""",
    )) {
      providers(json)
      assertTrue(ChosenModel.options(home).isEmpty(), json)
    }
  }

  @Test fun theManifestBindsTheHook() {
    val nodeJson = File(System.getProperty("phonecando.nodeRuntimeJson")).readText()
    val kind = ManifestKind.of(
      ManifestDecoder.decode(File(System.getProperty("phonecando.agentJson")).readText()),
      ClineHooks,
      mapOf("node" to RuntimePlugin.load(nodeJson) { "" }),
    )
    providers(signedIn)
    assertEquals(mapOf("model" to "cline-free/solar-mini4"), kind.acpHomeOptions(home))
    assertTrue(kind.acpOptions.isEmpty())
    assertTrue(ClineHooks.acpOptions("cline.other") == null)
  }
}
