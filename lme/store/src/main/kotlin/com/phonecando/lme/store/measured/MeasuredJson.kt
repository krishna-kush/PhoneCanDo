package com.phonecando.lme.store.measured

import kotlinx.serialization.Serializable

/** `<id>/.memory.json` on disk ([com.phonecando.lme.api.serve.MeasuredMemory]); [version] changes with any change of shape. */
@Serializable
internal data class MeasuredJson(
    val version: Int,
    val phone: String,
    val context: Long,
    val halfKvCache: Boolean,
    val mappedBytes: Long,
    val copiedBytes: Long,
    val stateBytes: Long,
    val computeBytes: Long,
)
