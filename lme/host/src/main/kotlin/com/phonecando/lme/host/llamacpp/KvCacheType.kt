package com.phonecando.lme.host.llamacpp

/**
 * A llama-server KV cache type (`--cache-type-k` / `--cache-type-v`) and
 * its bytes per block of 32 values. [F16] is the server's default; [Q8_0]
 * is half the size, needs every head in whole blocks
 * ([com.phonecando.lme.api.model.KvCacheShape.quantizable]) and, for the V
 * cache, flash attention, which the pinned server turns on by itself for
 * it (its CPU backend has it).
 */
enum class KvCacheType(val flag: String, val bytesPerBlock: Long) {
    F16("f16", 64),
    Q8_0("q8_0", 34),
}
