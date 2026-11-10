package com.phonecando.lme.gguf.read

/**
 * Bounds on what a header may claim, so a corrupt or hostile file fails fast
 * instead of making us read or allocate without end. The defaults clear
 * every model we know with room to spare: the tokenizer of a 262k-token
 * vocabulary is about 16 MB of header.
 */
data class GgufLimits(
    /** Bytes from the magic to the end of the tensor infos. */
    val headerBytes: Long = 256L shl 20,
    val metadataEntries: Long = 1L shl 16,
    val tensors: Long = 1L shl 20,
    /** llama.cpp keeps keys short; the spec's own cap is 65535 bytes. */
    val keyBytes: Long = 65_535,
    /** Any one string, kept or skipped. */
    val stringBytes: Long = 64L shl 20,
    /** Any one array, kept or skipped. */
    val arrayItems: Long = 16L shl 20,
    val keptStringBytes: Long = 4096,
    val keptArrayItems: Long = 4096,
) {
    companion object {
        val DEFAULT = GgufLimits()
    }
}
