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
 *   (a bool per layer, true = windowed, or a number P: every Pth layer is
 *   full). Without a pattern every layer counts as full, which only
 *   overestimates.
 *
 * Pure.
 */
internal object KvLayers {
    /** No model has this many layers; a bigger count is a broken file. */
    const val MAX_LAYERS = 4096L

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
        val windowed = if (window != null) windowedLayers(header, key("attention.sliding_window_pattern"), n) else BooleanArray(n)

        var full = 0L
        var swa = 0L
        for (layer in 0 until n) {
            if (interval != null && (layer + 1) % interval != 0L) continue
            if (layer >= layers - shared) continue
            if (windowed[layer]) {
                swa += kvHeads[layer] * (keyLengthSwa + valueLengthSwa)
            } else {
                full += kvHeads[layer] * (keyLength + valueLength)
            }
        }
        return KvCacheShape(full, swa, if (swa > 0) window else null)
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

    private fun windowedLayers(header: GgufHeader, key: String, layers: Int): BooleanArray {
        header.bools(key)?.let { flags ->
            if (flags.size < layers) throw LmeException.InvalidGguf("$key has ${flags.size} values for $layers layers")
            return BooleanArray(layers) { flags[it] }
        }
        // llama.cpp's set_swa_pattern: in each group of P layers the last is full.
        header.integer(key)?.takeIf { it > 0 }?.let { period -> return BooleanArray(layers) { it % period < period - 1 } }
        return BooleanArray(layers)
    }

    /** Head counts and lengths are small; anything else is a broken file, not a model to plan. */
    private fun checked(value: Long, key: String): Long {
        if (value !in 0..MAX_HEADS) throw LmeException.InvalidGguf("$key is $value")
        return value
    }

    private const val MAX_HEADS = 1L shl 16
}
