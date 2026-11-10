package com.phonecando.lme.cli

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelIds
import com.phonecando.lme.gguf.read.GgufReader
import com.phonecando.lme.gguf.shape.ModelShapes
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.io.IOException
import java.io.PrintStream

// lme's CLI for CI:
//   lme-cli plan --model <file.gguf> --id <model-id> --server <llama-server> --port <n> --key-env <NAME>
//     [--threads <n>] [--context <n>]
// prints the llama-server command LlamaCppRuntime.serve gives for that
// model: --context (kept within the model's range: the 16k floor up to its
// trained context; a phone sizes its own from its RAM, a CI host has no such
// budget), else the floor, every flag the phone's plan
// passes, without the phone's device and RAM checks, and without
// --cache-ram (the phone caps the prompt cache by its budget; a CI host
// keeps the server's default). One JSON line on stdout:
//   {"argv", "keyEnv", "healthUrl", "endpoint": {"baseUrl", "model", "contextWindow", "apis"}}
// The key is read from the variable --key-env names, checked to be a key
// ApiKeys would make, and never printed: the server takes it from the
// variable `keyEnv` names. --threads defaults to the host's processors.
// Exit codes: 0 the plan, 1 a model file it cannot read, 2 usage.
object Cli {
    const val USAGE = "usage: lme-cli plan --model <file.gguf> --id <model-id> --server <llama-server> --port <n> " +
        "--key-env <NAME> [--threads <n>] [--context <n>]"

    private val VALUED = setOf("--model", "--id", "--server", "--port", "--key-env", "--threads", "--context")

    fun main(args: List<String>, out: PrintStream, err: PrintStream, env: (String) -> String? = System::getenv): Int {
        if (args.isEmpty() || args.first() in listOf("help", "--help", "-h")) {
            out.println(USAGE)
            return 0
        }
        return try {
            require(args.first() == "plan") { "unknown command ${args.first()}" }
            plan(options(args.drop(1)), env, out)
        } catch (e: LmeException) {
            err.println("lme-cli: ${e.message}")
            1
        } catch (e: IOException) {
            err.println("lme-cli: ${e.message}")
            1
        } catch (e: IllegalArgumentException) {
            err.println("lme-cli: ${e.message}")
            err.println(USAGE)
            2
        }
    }

    private fun plan(options: Map<String, String>, env: (String) -> String?, out: PrintStream): Int {
        fun required(name: String) = options[name] ?: throw IllegalArgumentException("$name is required")
        val model = File(required("--model")).absoluteFile
        val id = required("--id")
        require(ModelIds.isValid(id)) { "--id is a model id (a-z, 0-9 and single dashes)" }
        val server = File(required("--server")).absoluteFile
        val port = required("--port").toIntOrNull() ?: throw IllegalArgumentException("--port is a number")
        val keyEnv = required("--key-env")
        val threads = options["--threads"]?.let { it.toIntOrNull() ?: throw IllegalArgumentException("--threads is a number") }
            ?: Runtime.getRuntime().availableProcessors()
        val key = env(keyEnv).orEmpty()
        require(key.isNotEmpty()) { "$keyEnv (--key-env) holds no key" }

        val shape = model.inputStream().use { ModelShapes.of(GgufReader.read(it)) }
        // serve() refuses a key ApiKeys would not make, without naming it.
        val range = ContextRange.of(shape.contextLength)
        val context = options["--context"]?.let { it.toLongOrNull() ?: throw IllegalArgumentException("--context is a number") }
            ?.let(range::coerce) ?: range.min
        val command = LlamaCppRuntime.serve(server.path, model.path, id, context, null, port, threads, key)
        val endpoint = command.endpoint
        out.println(
            buildJsonObject {
                put("argv", JsonArray(command.argv.map(::JsonPrimitive)))
                put("keyEnv", LlamaCppRuntime.KEY_ENV)
                put("healthUrl", command.healthUrl)
                put(
                    "endpoint",
                    buildJsonObject {
                        put("baseUrl", endpoint.baseUrl)
                        put("model", endpoint.model)
                        put("contextWindow", endpoint.contextWindow)
                        put("apis", JsonArray(endpoint.apis.sortedBy { it.ordinal }.map { JsonPrimitive(it.id) }))
                    },
                )
            },
        )
        return 0
    }

    private fun options(args: List<String>): Map<String, String> {
        val options = mutableMapOf<String, String>()
        var i = 0
        while (i < args.size) {
            val name = args[i]
            require(name in VALUED) { "unknown option $name" }
            options[name] = args.getOrNull(i + 1)?.takeUnless { it.startsWith("--") }
                ?: throw IllegalArgumentException("$name needs a value")
            i += 2
        }
        return options
    }
}
