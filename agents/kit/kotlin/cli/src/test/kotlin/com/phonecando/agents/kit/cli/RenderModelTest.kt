package com.phonecando.agents.kit.cli

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// render-model on made-up kinds laid out as agents/ is: an image kind that
// needs the node runtime and speaks two APIs, and a native one.
class RenderModelTest {
  @TempDir lateinit var root: File

  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))
  private val key = "3f9c0a7d1e2b4c6a8f0e1d2c3b4a5968778695a4b3c2d1e0"

  private val imageKind = """
    {"schema":1,"id":"m","label":"M","version":"1","type":"image","channels":["full"],"stability":"preview",
     "licence":{"spdx":"MIT","redistributed":false,"source":"https://example.com/m"},
     "requires":{"linux":"required","runtimes":["node>=22"]},
     "install":{"steps":["true"]},"versionCheck":{"argv":["m","--version"],"pattern":"(\\d+)"},
     "engine":{"style":"tui","launch":{"argv":["/root/.local/bin/m","--tui"],"env":{"M_NO_UPDATE":"1","M_HOME":"{{home}}/.m"},
       "cwd":"{{projectDir}}"},"readiness":{"alive":{}}},
     "phoneTools":"none",
     "models":{
       "openai-responses":{"args":["-c","base={{baseUrl}}/v1","-m","{{model}}"],"env":{"M_KEY":"{{modelKey}}"}},
       "anthropic":{"env":{"ANTHROPIC_BASE_URL":"{{baseUrl}}","ANTHROPIC_AUTH_TOKEN":"Bearer {{modelKey}}","CTX":"{{contextWindow}}"}}
     }}
  """

  private val nativeKind = """
    {"schema":1,"id":"n","label":"N","version":"1","type":"native","prefix":"nn","channels":["full"],"stability":"stable",
     "licence":{"spdx":"MIT","redistributed":true,"notice":"NOTICE.md","source":"https://example.com/n"},
     "payload":{"libs":[{"name":"libnn-engine.so","from":"n","role":"engine","linkage":"system-only"}]},"build":{"toolchains":["bun"]},
     "engine":{"style":"server","launch":{"argv":["{{libDir}}/libnn-engine.so","serve","--port","{{port}}"],
       "env":{"N_PASSWORD":"{{password}}","N_LIB":"{{libDir}}/libnn-x.so"}},"readiness":{"http":{"path":"/"}}},
     "phoneTools":"none",
     "models":{"openai-chat":{"env":{"N_CONFIG":"{\"url\":\"{{baseUrl}}/v1\",\"model\":\"{{model}}\"}","N_KEY":"{{modelKey}}"}}}}
  """

  private fun kind(type: String, id: String, manifest: String, oneShot: String?): String {
    val dir = File(root, "agents/$type/$id").apply { mkdirs() }
    File(dir, "agent.json").writeText(manifest)
    oneShot?.let { File(dir, OneShot.FILE).writeText(it) }
    val node = File(root, "agents/runtimes/node/install")
    if (!node.exists()) {
      node.mkdirs()
      File(fixtures, "runtime/valid/node.json").copyTo(File(node.parentFile, "runtime.json"))
      File(node, "glibc.sh").writeText("echo glibc\n")
      File(node, "apk.sh").writeText("echo apk\n")
    }
    return dir.path
  }

  private val image get() = kind("image", "m", imageKind, """{"argv":["/root/.local/bin/m","-p","{{prompt}}","--yes"],"env":{"M_QUIET":"1"}}""")

  private fun run(vararg args: String, keyEnv: Map<String, String> = mapOf("LLAMA_KEY" to key)): Triple<Int, String, String> {
    val out = ByteArrayOutputStream()
    val err = ByteArrayOutputStream()
    val code = Cli.main(args.toList(), PrintStream(out, true), PrintStream(err, true)) { keyEnv[it] }
    return Triple(code, out.toString(), err.toString())
  }

  private fun model(kindDir: String, apis: String, vararg more: String) = run(
    "render-model", "--kind", kindDir, "--base-url", "http://127.0.0.1:8099/", "--model", "qwen3-5-0-8b",
    "--context", "16384", "--apis", apis, "--key-env", "LLAMA_KEY", "--prompt", "say {{hi}} \$HOME", *more,
  )

  private fun json(out: String): JsonObject = Json.parseToJsonElement(out).jsonObject

  private fun JsonObject.strings(name: String) = getValue(name).jsonArray.map { it.jsonPrimitive.content }

  private fun JsonObject.map(name: String) = getValue(name).jsonObject.mapValues { it.value.jsonPrimitive.content }

  @Test fun theOneShotWithTheKindsFirstServedApiGuestSide() {
    val (code, out, err) = model(image, "openai-chat,openai-responses,anthropic")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals("openai-responses", r.getValue("api").jsonPrimitive.content)
    assertEquals(
      listOf("/root/.local/bin/m", "-c", "base=http://127.0.0.1:8099/v1", "-m", "qwen3-5-0-8b", "-p", "say {{hi}} \$HOME", "--yes"),
      r.strings("argv"),
      "model args right after the program; the prompt as given, never rendered",
    )
    assertEquals("/root/projects", r.getValue("cwd").jsonPrimitive.content)
    assertEquals(listOf("/root/.local/opt/node/bin"), r.strings("path"))
    assertEquals(
      mapOf("M_NO_UPDATE" to "1", "M_HOME" to "/root/.m", "M_QUIET" to "1", "HOME" to "/root", "TMPDIR" to "/tmp"),
      r.map("env"),
    )
    assertEquals(mapOf("M_KEY" to "{{modelKey}}"), r.map("keyEnv"))
    assertEquals("LLAMA_KEY", r.getValue("key").jsonPrimitive.content)
    assertFalse(key in out || key in err, "the key's value is never printed")
  }

  @Test fun aKeyInsideAValueStaysAPlaceholder() {
    val (code, out, err) = model(image, "anthropic")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals("anthropic", r.getValue("api").jsonPrimitive.content)
    assertEquals(listOf("/root/.local/bin/m", "-p", "say {{hi}} \$HOME", "--yes"), r.strings("argv"))
    assertEquals(mapOf("ANTHROPIC_AUTH_TOKEN" to "Bearer {{modelKey}}"), r.map("keyEnv"))
    assertEquals("http://127.0.0.1:8099", r.map("env")["ANTHROPIC_BASE_URL"])
    assertEquals("16384", r.map("env")["CTX"])
  }

  @Test fun aNativeKindRunsFromItsLibDir() {
    val dir = kind("native", "n", nativeKind, """{"argv":["{{libDir}}/libnn-engine.so","run","{{prompt}}"]}""")
    val (code, out, err) = model(dir, "openai-chat", "--lib-dir", "/opt/n/lib")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals(listOf("/opt/n/lib/libnn-engine.so", "run", "say {{hi}} \$HOME"), r.strings("argv"))
    assertEquals("""{"url":"http://127.0.0.1:8099/v1","model":"qwen3-5-0-8b"}""", r.map("env")["N_CONFIG"])
    assertEquals("/opt/n/lib/libnn-x.so", r.map("env")["N_LIB"])
    assertEquals("", r.map("env")["N_PASSWORD"], "no engine password in a one-shot")
    assertFalse("HOME" in r.map("env"), "a native kind's HOME is the host's")
    assertEquals(emptyList(), r.strings("path"))
    val noLibDir = model(dir, "openai-chat")
    assertEquals(2, noLibDir.first)
    assertTrue("--lib-dir" in noLibDir.third, noLibDir.third)
  }

  @Test fun refusesAServerItCannotTalkTo() {
    val (code, out, err) = model(image, "openai-chat")
    assertEquals(1 to "", code to out)
    assertTrue("m speaks openai-responses, anthropic; the server serves openai-chat" in err, err)
  }

  @Test fun refusesAKindWithoutModelsOrOneShot() {
    val bare = kind("image", "m", imageKind, null)
    val noOneShot = model(bare, "anthropic")
    assertEquals(1, noOneShot.first)
    assertTrue("m has no one-shot mode (one-shot.json)" in noOneShot.third, noOneShot.third)
    val noModels = kind("image", "m", imageKind.replace(Regex("""(?s),\s*"models":\{.*\}\s*\}\s*$"""), "}"), """{"argv":["m","{{prompt}}"]}""")
    val refused = model(noModels, "anthropic")
    assertEquals(1, refused.first)
    assertTrue("m takes no local model" in refused.third, refused.third)
  }

  @Test fun refusesABrokenOneShot() {
    for ((oneShot, why) in listOf(
      """{"argv":["m","run"]}""" to "/argv: holds {{prompt}} as exactly one item",
      """{"argv":["{{prompt}}","m"]}""" to "/argv: holds {{prompt}} as exactly one item",
      """{"argv":["m","{{prompt}}"],"timeout":5}""" to "/timeout: unknown field",
      """{"argv":["m","{{prompt}}"],"env":{"A":1}}""" to "/env/A: ",
    )) {
      val (code, _, err) = model(kind("image", "m", imageKind, oneShot), "anthropic")
      assertEquals(1, code, oneShot)
      assertTrue(why in err, "$oneShot: $err")
    }
  }

  @Test fun theKeyComesFromTheEnvironmentOnly() {
    val (code, _, err) = run(
      "render-model", "--kind", image, "--base-url", "http://127.0.0.1:8099", "--model", "q", "--context", "16384",
      "--apis", "anthropic", "--key-env", "LLAMA_KEY", "--prompt", "hi",
      keyEnv = emptyMap(),
    )
    assertEquals(2, code)
    assertTrue("LLAMA_KEY (--key-env) holds no key" in err, err)
  }

  @Test fun usage() {
    for (bad in listOf(
      arrayOf("--apis", "gemini"),
      arrayOf("--apis", ""),
      arrayOf("--context", "0"),
      arrayOf("--base-url", "127.0.0.1:8099"),
      arrayOf("--key-env", "LLAMA-KEY"),
    )) {
      val args = mutableMapOf(
        "--kind" to image, "--base-url" to "http://127.0.0.1:8099", "--model" to "q", "--context" to "16384",
        "--apis" to "anthropic", "--key-env" to "LLAMA_KEY", "--prompt" to "hi",
      )
      args[bad[0]] = bad[1]
      val (code, _, err) = run("render-model", *args.flatMap { listOf(it.key, it.value) }.toTypedArray())
      assertEquals(2, code, bad.joinToString(" "))
      assertTrue(Cli.USAGE in err, err)
    }
    val missing = run("render-model", "--kind", image)
    assertEquals(2, missing.first)
    assertTrue("--base-url is required" in missing.third, missing.third)
  }
}
