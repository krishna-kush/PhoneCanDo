package com.phonecando.lre.cli.base

import com.phonecando.lre.api.Compression

/** A tarball's compression from its first bytes, whatever its name says. Pure. */
object CompressionSniff {
    /** Bytes [of] looks at. */
    const val HEAD_BYTES = 6

    private val GZIP = byteArrayOf(0x1f, 0x8b.toByte())
    private val XZ = byteArrayOf(0xfd.toByte(), 0x37, 0x7a, 0x58, 0x5a, 0x00)
    private val ZSTD = byteArrayOf(0x28, 0xb5.toByte(), 0x2f, 0xfd.toByte())

    /** GZIP, XZ or ZSTD by magic number; anything else is read as a plain tar. */
    fun of(head: ByteArray): Compression = when {
        head.startsWith(GZIP) -> Compression.GZIP
        head.startsWith(XZ) -> Compression.XZ
        head.startsWith(ZSTD) -> Compression.ZSTD
        else -> Compression.NONE
    }

    private fun ByteArray.startsWith(magic: ByteArray) =
        size >= magic.size && magic.indices.all { this[it] == magic[it] }
}
