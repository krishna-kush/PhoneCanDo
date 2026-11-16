package com.phonecando.lme.gguf.shape

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.gguf.read.GgufHeader

/**
 * The KV cache a model's layers keep, read the way llama.cpp sizes it, from
 * the `<arch>.*` keys:
 *
 * - `attention.head_count_kv` per layer (a number, or one per layer where 0
 *   means no cache: hybrid models), else `attention.head_count`
 * - `attention.key_length` / `value_length`, else embedding / heads; the
 *   `_swa` variants for sliding-window layers
 * - `full_attention_interval` N: only every Nth layer has a cache (Qwen3.5,
 *   Qwen3-Next); the rest are recurrent
 * - `attention.shared_kv_layers` S: the last S layers reuse earlier caches
 *   (Gemma 3n and 4)
 * - `attention.sliding_window` W with `attention.sliding_window_pattern`
 *   (a bool per layer, true = windowed, or a number P: one layer in each P
 *   is full), else llama.cpp's own period for the architecture
 *   ([SwaPatterns]). With neither, every layer counts as full and as
 *   windowed: an upper bound for the KV cache and for what a checkpoint
 *   copies, never less than the server keeps.
 *
 * It may be 8-bit ([KvCacheShape.quantizable]) when every key and value
 * head length it uses is a whole number of [Q8_BLOCK]-value blocks: the
 * server refuses a q8_0 cache otherwise. Pure.
 */
internal object KvLayers {
    /** No model has this many layers; a bigger count is a broken file. */
    const val MAX_LAYERS = 4096L

    /** The values in one block of llama.cpp's q8_0 type. */
    const val Q8_BLOCK = 32L

    fun of(header: GgufHeader, arch: String, layers: Long): KvCacheShape {
        if (layers !in 1..MAX_LAYERS) throw LmeException.InvalidGguf("$arch.block_count is $layers")
        val n = layers.toInt()
        fun key(name: String) = "$arch.$name"

        val heads = perLayer(header, key("attention.head_count"), n, default = 0)
        val kvHeads = if (header.has(key("attention.head_count_kv"))) {
            perLayer(header, key("attention.head_count_kv"), n, default = 0)
        } else {
            heads
        }
        val embedding = header.integer(key("embedding_length")) ?: 0
        val defaultHead = if (heads[0] > 0) embedding / heads[0] else 0
        val keyLength = header.integer(key("attention.key_length")) ?: defaultHead
        val valueLength = header.integer(key("attention.value_length")) ?: keyLength
        val keyLengthSwa = header.integer(key("attention.key_length_swa")) ?: keyLength
        val valueLengthSwa = header.integer(key("attention.value_length_swa")) ?: valueLength

        val interval = header.integer(key("full_attention_interval"))?.takeIf { it > 0 }
        val shared = header.integer(key("attention.shared_kv_layers"))?.coerceIn(0, layers) ?: 0
        val window = header.integer(key("attention.sliding_window"))?.takeIf { it > 0 }
        val windowed = if (window != null) windowedLayers(header, arch, key("attention.sliding_window_pattern"), n) else BooleanArray(n)

        var full = 0L
        var swa = 0L
        for (layer in 0 until n) {
            if (interval != null && (layer + 1) % interval != 0L) continue
            if (layer >= layers - shared) continue
            if (windowed == null || windowed[layer]) swa += kvHeads[layer] * (keyLengthSwa + valueLengthSwa)
            if (windowed == null || !windowed[layer]) full += kvHeads[layer] * (keyLength + valueLength)
        }
        val lengths = listOf(keyLength, valueLength) + if (swa > 0) listOf(keyLengthSwa, valueLengthSwa) else emptyList()
        val quantizable = full + swa > 0 && lengths.all { it > 0 && it % Q8_BLOCK == 0L }
        return KvCacheShape(full, swa, if (swa > 0) window else null, quantizable = quantizable)
    }

    /** A number for every layer, or one per layer; nothing at all gives [default]. */
    private fun perLayer(header: GgufHeader, key: String, layers: Int, default: Long): LongArray {
        header.integer(key)?.let { return LongArray(layers) { _ -> checked(it, key) } }
        val values = header.integers(key) ?: if (header.has(key)) {
            throw LmeException.InvalidGguf("$key is not a number")
        } else {
            return LongArray(layers) { default }
        }
        if (values.size < layers) throw LmeException.InvalidGguf("$key has ${values.size} values for $layers layers")
        return LongArray(layers) { checked(values[it], key) }
    }

    /** The windowed layers, as llama.cpp reads them for [arch]; null when neither the header nor [SwaPatterns] says. */
    private fun windowedLayers(header: GgufHeader, arch: String, key: String, layers: Int): BooleanArray? {
        header.bools(key)?.let { flags ->
            if (flags.size < layers) throw LmeException.InvalidGguf("$key has ${flags.size} values for $layers layers")
            return BooleanArray(layers) { flags[it] }
        }
        val rule = SwaPatterns.of(arch)
        val period = header.integer(key) ?: rule?.period ?: return null
        if (period !in 0..MAX_LAYERS) throw LmeException.InvalidGguf("$key is $period")
        return SwaPatterns.windowed(period, rule?.denseFirst ?: false, layers)
    }

    /** Head counts and lengths are small; anything else is a broken file, not a model to plan. */
    private fun checked(value: Long, key: String): Long {
        if (value !in 0..MAX_HEADS) throw LmeException.InvalidGguf("$key is $value")
        return value
    }

    private const val MAX_HEADS = 1L shl 16
}
