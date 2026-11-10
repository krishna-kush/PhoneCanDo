package com.phonecando.lme.api.model

/**
 * What a model's GGUF header says about it: enough to name it and to plan
 * its memory. Every field but [architecture], [blockCount] and [kvCache]
 * may be missing from a file.
 *
 * @property quant the quantisation name from `general.file_type` (`Q4_K_M`)
 * @property contextLength the context the model was trained for
 * @property baseModel the model the file was converted from, when the header names one
 */
data class ModelShape(
    val architecture: String,
    val name: String?,
    val quant: String?,
    val parameterCount: Long?,
    val contextLength: Long?,
    val blockCount: Long,
    val embeddingLength: Long?,
    val kvCache: KvCacheShape,
    val baseModel: BaseModelRef? = null,
)

/**
 * The model's KV cache per token of context, counted in values (a runtime
 * multiplies by its cache type's bytes per value). Layers that keep every
 * token add to [fullPerToken]; sliding-window layers add to
 * [windowPerToken] and keep at most [slidingWindow] tokens plus one batch.
 * Layers with no cache of their own (the recurrent layers of a hybrid model,
 * layers that reuse another layer's cache) add nothing.
 */
data class KvCacheShape(val fullPerToken: Long, val windowPerToken: Long, val slidingWindow: Long?) {
    companion object {
        val NONE = KvCacheShape(0, 0, null)
    }
}
