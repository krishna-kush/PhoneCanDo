package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.KvCacheShape

/**
 * The most one prompt's state takes in llama-server besides the model's
 * files: the KV cache at the context ([KvBytes]), the recurrent state of
 * one sequence, and its context checkpoints. The slot holds that much, and
 * so does each prompt the prompt cache keeps (the server saves a prompt
 * with its checkpoints). Pure: the runtime passes its cache types' sizes.
 */
object PromptState {
    fun bytes(kv: KvCacheShape, contextSize: Long, kvBytesPerBlock: Long, recurrentBytesPerValue: Long, checkpoints: Int): Long =
        KvBytes.of(kv, contextSize, kvBytesPerBlock) +
            kv.recurrentPerSequence * recurrentBytesPerValue +
            checkpoints * checkpointBytes(kv, contextSize, kvBytesPerBlock, recurrentBytesPerValue)

    /**
     * One context checkpoint: the part of the state that cannot roll back,
     * the recurrent state and the sliding-window layers' KV cache (the
     * server's partial state save). Zero for a model with neither, which
     * gets no checkpoints.
     */
    fun checkpointBytes(kv: KvCacheShape, contextSize: Long, kvBytesPerBlock: Long, recurrentBytesPerValue: Long): Long =
        kv.recurrentPerSequence * recurrentBytesPerValue + KvBytes.window(kv, contextSize, kvBytesPerBlock)
}
