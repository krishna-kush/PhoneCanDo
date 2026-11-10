package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.KvCacheShape

/**
 * A KV cache's size in bytes, sized the way llama.cpp sizes it for one
 * sequence: full layers keep [contextSize] cells; sliding-window layers keep
 * the window plus one micro-batch, padded to 256 cells, at most
 * [contextSize] (`llama_kv_cache_iswa`). Pure.
 */
object KvBytes {
    /** llama-server's default `--ubatch-size`. */
    const val MICRO_BATCH = 512L
    private const val PAD = 256L

    fun of(kv: KvCacheShape, contextSize: Long, bytesPerValue: Long): Long {
        val windowCells = kv.slidingWindow?.let { pad(minOf(contextSize, it + MICRO_BATCH)) } ?: 0
        return bytesPerValue * (kv.fullPerToken * contextSize + kv.windowPerToken * windowCells)
    }

    private fun pad(cells: Long): Long = (cells + PAD - 1) / PAD * PAD
}
