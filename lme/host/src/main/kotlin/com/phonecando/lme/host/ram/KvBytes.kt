package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.KvCacheShape

/**
 * A KV cache's size in bytes, sized the way llama.cpp sizes it for one
 * sequence: full layers keep [contextSize] cells; sliding-window layers keep
 * the window plus one micro-batch, padded to 256 cells, at most
 * [contextSize] (`llama_kv_cache_iswa`). The cache type counts in bytes per
 * block of [BLOCK] values (f16: 64, q8_0: 34). Pure.
 */
object KvBytes {
    /** llama-server's default `--ubatch-size`. */
    const val MICRO_BATCH = 512L

    /** The values a cache type's bytes are counted per. */
    const val BLOCK = 32L
    private const val PAD = 256L

    fun of(kv: KvCacheShape, contextSize: Long, bytesPerBlock: Long): Long =
        bytesPerBlock * kv.fullPerToken * contextSize / BLOCK + window(kv, contextSize, bytesPerBlock)

    /** The sliding-window layers' part alone: what a context checkpoint copies of the KV cache. */
    fun window(kv: KvCacheShape, contextSize: Long, bytesPerBlock: Long): Long {
        val windowCells = kv.slidingWindow?.let { pad(minOf(contextSize, it + MICRO_BATCH)) } ?: 0
        return bytesPerBlock * kv.windowPerToken * windowCells / BLOCK
    }

    private fun pad(cells: Long): Long = (cells + PAD - 1) / PAD * PAD
}
