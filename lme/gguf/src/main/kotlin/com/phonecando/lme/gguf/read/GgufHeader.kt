package com.phonecando.lme.gguf.read

/**
 * A parsed GGUF header: the metadata (big values skipped, see [GgufValue])
 * and what the tensor infos add up to.
 *
 * @property parameterCount the elements of every tensor in this file; for a
 *   split model, of this part only
 * @property headerBytes bytes from the magic to the end of the tensor infos
 */
class GgufHeader(
    val version: Int,
    val tensorCount: Long,
    val metadata: Map<String, GgufValue>,
    val parameterCount: Long,
    val headerBytes: Long,
) {
    fun string(key: String): String? = (metadata[key] as? GgufValue.Text)?.value

    fun integer(key: String): Long? = (metadata[key] as? GgufValue.Integer)?.value

    /** An integer array's values; null when [key] is missing, skipped or of another type. */
    fun integers(key: String): List<Long>? =
        (metadata[key] as? GgufValue.Items)?.values?.map { (it as? GgufValue.Integer)?.value ?: return null }

    fun bools(key: String): List<Boolean>? =
        (metadata[key] as? GgufValue.Items)?.values?.map { (it as? GgufValue.Bool)?.value ?: return null }

    fun has(key: String): Boolean = key in metadata
}
