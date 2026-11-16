package com.phonecando.lme.gguf.shape

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.gguf.read.GgufHeader

/**
 * The state a model's recurrent layers keep for one sequence, in values,
 * sized the way llama.cpp sizes it (`llama_hparams::n_embd_r` plus
 * `n_embd_s`, per recurrent layer), from the `<arch>.*` keys:
 *
 * - RWKV (`wkv.head_size` H): `token_shift_count` (2) x embedding, plus
 *   embedding x H
 * - short convolutions (`shortconv.l_cache` L, LFM2): embedding x (L - 1)
 * - KDA (`kda.head_dim` D, Kimi Linear): 3 x (conv kernel - 1) x heads x D,
 *   plus D x D x heads
 * - SSM (`ssm.*`: Mamba, Mamba2, the gated delta nets of Qwen3.5 and
 *   Qwen3-Next, Jamba, Granite and Nemotron hybrids): (conv kernel - 1) x
 *   (inner + 2 x groups x state), plus state x inner
 *
 * The recurrent layers: all but every Nth (`full_attention_interval` N),
 * else those with no KV heads (`attention.head_count_kv` per layer), else
 * every layer (Mamba, RWKV, and hybrids that run both in each layer). Zero
 * for a model with none of those keys: one with attention only. Pure.
 */
internal object RecurrentState {
    /** No real model has a dimension this big; a bigger one is a broken file. */
    private const val MAX_DIM = 1L shl 20

    fun of(header: GgufHeader, arch: String, layers: Long): Long {
        fun dim(name: String): Long {
            val key = "$arch.$name"
            val value = header.integer(key) ?: return 0
            if (value !in 0..MAX_DIM) throw LmeException.InvalidGguf("$key is $value")
            return value
        }

        val embedding = dim("embedding_length")
        val wkv = dim("wkv.head_size")
        val lCache = dim("shortconv.l_cache")
        val kda = dim("kda.head_dim")
        val conv = dim("ssm.conv_kernel")
        val inner = dim("ssm.inner_size")
        val state = dim("ssm.state_size")
        val groups = dim("ssm.group_count")
        val heads = header.integer("$arch.attention.head_count")?.coerceIn(0, MAX_DIM)
            ?: header.integers("$arch.attention.head_count")?.firstOrNull()?.coerceIn(0, MAX_DIM) ?: 0

        // The rolling state (n_embd_r), then the recurrent one (n_embd_s), as llama.cpp picks them.
        val rolling = when {
            wkv > 0 -> (header.integer("$arch.token_shift_count")?.coerceIn(0, MAX_DIM) ?: 2) * embedding
            lCache > 0 -> embedding * (lCache - 1)
            kda > 0 -> 3 * (if (conv > 0) conv - 1 else 3) * heads * kda
            else -> (if (conv > 0) conv - 1 else 0) * (inner + 2 * groups * state)
        }
        val recurrent = when {
            wkv > 0 -> embedding * wkv
            kda > 0 -> kda * kda * heads
            else -> state * inner
        }
        val perLayer = rolling + recurrent
        return if (perLayer == 0L) 0 else perLayer * recurrentLayers(header, arch, layers)
    }

    private fun recurrentLayers(header: GgufHeader, arch: String, layers: Long): Long {
        header.integer("$arch.full_attention_interval")?.takeIf { it > 0 }?.let { return layers - layers / it }
        header.integers("$arch.attention.head_count_kv")?.let { kv -> return kv.take(layers.toInt()).count { it == 0L }.toLong() }
        return layers
    }
}
