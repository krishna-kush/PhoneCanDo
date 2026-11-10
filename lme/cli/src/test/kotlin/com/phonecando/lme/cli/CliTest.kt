package com.phonecando.lme.cli

import com.phonecando.lme.gguf.testkit.Models
import com.phonecando.lme.host.key.ApiKeys
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
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

// lme-cli plan on synthetic GGUF headers (gguf's test fixtures).
class CliTest {
    @TempDir lateinit var dir: File

    private val key = ApiKeys.newKey()

    private fun run(vararg args: String, keys: Map<String, String> = mapOf("LLAMA_KEY" to key)): Triple<Int, String, String> {
        val out = ByteArrayOutputStream()
        val err = ByteArrayOutputStream()
        val code = Cli.main(args.toList(), PrintStream(out, true), PrintStream(err, true)) { keys[it] }
        return Triple(code, out.toString(), err.toString())
    }

    private fun gguf(): String = File(dir, "qwen.gguf").apply { writeBytes(Models.qwen35().build()) }.path

    private fun plan(model: String, vararg more: String, keys: Map<String, String> = mapOf("LLAMA_KEY" to key)) = run(
        "plan", "--model", model, "--id", "qwen3-5-4b-q4-k-m", "--server", "/opt/llama-server", "--port", "18080",
        "--key-env", "LLAMA_KEY", *more, keys = keys,
    )

    @Test
    fun `the phone's flags and endpoint for a host`() {
        val model = gguf()
        val (code, out, err) = plan(model, "--threads", "3")
        assertEquals(0, code, err)
        val plan = Json.parseToJsonElement(out).jsonObject
        assertEquals(
            listOf(
                "/opt/llama-server", "--model", model, "--alias", "qwen3-5-4b-q4-k-m", "--host", "127.0.0.1", "--port", "18080",
                "--ctx-size", "16384", "--parallel", "1", "--threads", "3", "--jinja", "--reasoning", "off", "--no-ui",
            ),
            plan.getValue("argv").jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals("LLAMA_API_KEY", plan.getValue("keyEnv").jsonPrimitive.content)
        assertEquals("http://127.0.0.1:18080/health", plan.getValue("healthUrl").jsonPrimitive.content)
        val endpoint = plan.getValue("endpoint").jsonObject
        assertEquals("http://127.0.0.1:18080", endpoint.getValue("baseUrl").jsonPrimitive.content)
        assertEquals("qwen3-5-4b-q4-k-m", endpoint.getValue("model").jsonPrimitive.content)
        assertEquals(16_384, endpoint.getValue("contextWindow").jsonPrimitive.int)
        assertEquals(listOf("openai-chat", "openai-responses", "anthropic"), endpoint.getValue("apis").jsonArray.map { it.jsonPrimitive.content })
        assertFalse(key in out || key in err, "the key is never printed")
        val threads = Json.parseToJsonElement(plan(model).second).jsonObject.getValue("argv").jsonArray.map { it.jsonPrimitive.content }
        assertEquals(Runtime.getRuntime().availableProcessors().toString(), threads[threads.indexOf("--threads") + 1])
    }

    @Test
    fun `a key not from ApiKeys, or none, is refused without showing it`() {
        val model = gguf()
        val bad = plan(model, keys = mapOf("LLAMA_KEY" to "hunter2"))
        assertEquals(2, bad.first)
        assertTrue("not a key from ApiKeys" in bad.third && "hunter2" !in bad.third, bad.third)
        val none = plan(model, keys = emptyMap())
        assertEquals(2, none.first)
        assertTrue("LLAMA_KEY (--key-env) holds no key" in none.third, none.third)
    }

    @Test
    fun `a file that is not a model is refused`() {
        val text = File(dir, "x.gguf").apply { writeText("not a model") }.path
        val (code, _, err) = plan(text)
        assertEquals(1, code)
        assertTrue("not a usable GGUF file" in err, err)
        assertEquals(1, plan(File(dir, "missing.gguf").path).first)
    }

    @Test
    fun usage() {
        assertEquals(0, run().first)
        for (bad in listOf(arrayOf("serve"), arrayOf("plan", "--model"), arrayOf("plan", "--x", "1"), arrayOf("plan", "--model", "m"))) {
            val (code, _, err) = run(*bad)
            assertEquals(2, code, bad.joinToString(" "))
            assertTrue(Cli.USAGE in err)
        }
        val badId = run("plan", "--model", gguf(), "--id", "Qwen3.5", "--server", "/s", "--port", "1", "--key-env", "LLAMA_KEY")
        assertEquals(2, badId.first)
    }
}
