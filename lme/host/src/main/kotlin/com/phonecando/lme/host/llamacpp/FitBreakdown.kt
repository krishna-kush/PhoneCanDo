package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.serve.MeasuredMemory
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * llama.cpp's own count of a model's server, from its `--fit` dry run: at
 * each start, before it loads anything, the pinned server sizes every
 * buffer it would allocate for our flags (`common/fit.cpp`: the header
 * read, no weight loaded or allocated) and, with `--log-jsonl`, logs them as one
 * `fit_memory_breakdown` line on stdout, in MiB: a `host` row (weights read
 * in place, the KV cache, the compute buffer) and a `buffer_type` row per
 * other buffer (CPU_REPACK and CPU_KLEIDIAI: weights copied into the CPU's
 * own layouts). Its own total leaves those copies out on a CPU-only build
 * (`lme/docs/planning/todo.md`), so we read the rows. `--log-jsonl` turns
 * every other line into JSON too, so only a dry run of its own logs this
 * way, never the server agents use (its log page). Pure.
 */
object FitBreakdown {
    /** The line's `type`. */
    const val EVENT = "fit_memory_breakdown"

    private const val MIB = 1L shl 20
    private val JSON = Json { ignoreUnknownKeys = true }

    /**
     * The dry run of the server [argv] ([LlamaCppRuntime.plan]'s): the same
     * flags on a port of its own choosing (it listens before it loads),
     * without the chats dir, with `--fit on` (the pinned default) and
     * `--log-jsonl`. Stopped once it has logged [EVENT].
     */
    fun dryRun(argv: List<String>): List<String> {
        val out = ArrayList<String>(argv.size + 3)
        var i = 0
        while (i < argv.size) {
            when (argv[i]) {
                "--port" -> { out += "--port"; out += "0"; i += 2 }
                "--slot-save-path" -> i += 2
                else -> { out += argv[i]; i += 1 }
            }
        }
        return out + listOf("--fit", "on", "--log-jsonl")
    }

    /**
     * [line] as a measurement taken on [phone] at [context] tokens with an
     * 8-bit KV cache or not ([halfKvCache]); null when it is not an [EVENT]
     * line in MiB with a host row.
     */
    fun parse(line: String, phone: String, context: Long, halfKvCache: Boolean): MeasuredMemory? {
        val text = line.trim()
        if (!text.startsWith("{") || EVENT !in text) return null
        val doc = try {
            JSON.parseToJsonElement(text) as? JsonObject
        } catch (_: IllegalArgumentException) {
            null
        } ?: return null
        if (doc.string("type") != EVENT) return null
        val data = doc["data"] as? JsonObject ?: return null
        if (data.string("unit") != "MiB") return null
        val rows = (data["rows"] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: return null
        val host = rows.firstOrNull { it.string("kind") == "host" } ?: return null
        val others = rows.filter { it !== host }
        return MeasuredMemory(
            phone = phone,
            context = context,
            halfKvCache = halfKvCache,
            mappedBytes = host.mib("model"),
            copiedBytes = others.sumOf { it.mib("model") },
            stateBytes = rows.sumOf { it.mib("context") },
            computeBytes = rows.sumOf { it.mib("compute") },
        )
    }

    private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

    // A whole MiB count (the server rounds down), as bytes; a field missing or negative counts 0.
    private fun JsonObject.mib(key: String): Long = ((this[key] as? JsonPrimitive)?.longOrNull ?: 0L).coerceAtLeast(0) * MIB
}
