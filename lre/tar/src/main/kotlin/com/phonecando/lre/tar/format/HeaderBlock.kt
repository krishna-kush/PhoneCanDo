package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException

/** One raw 512-byte tar header, decoded (POSIX ustar, GNU and v7 layouts). */
internal class HeaderBlock(
    /** Name with the ustar prefix joined in; GNU and PAX overrides come later. */
    val name: String,
    val mode: Int,
    val size: Long,
    /** Seconds since the epoch. */
    val mtime: Long,
    val type: Char,
    val linkName: String,
) {
    companion object {
        const val SIZE = 512

        fun isZero(block: ByteArray): Boolean = block.all { it == 0.toByte() }

        fun parse(block: ByteArray): HeaderBlock {
            verifyChecksum(block)
            var name = text(block, 0, 100)
            // Only POSIX ustar has a prefix; GNU keeps atime/ctime in those bytes.
            if (matches(block, 257, USTAR_MAGIC)) {
                val prefix = text(block, 345, 155)
                if (prefix.isNotEmpty()) name = "$prefix/$name"
            }
            return HeaderBlock(
                name = name,
                mode = TarNumbers.parse(block, 100, 8, "mode").toInt(),
                size = TarNumbers.parse(block, 124, 12, "size"),
                mtime = TarNumbers.parse(block, 136, 12, "mtime"),
                type = (block[156].toInt() and 0xff).toChar(),
                linkName = text(block, 157, 100),
            )
        }

        /** Sum of all bytes with the checksum field read as spaces; old writers summed signed bytes. */
        private fun verifyChecksum(block: ByteArray) {
            val stored = TarNumbers.parse(block, 148, 8, "checksum")
            var unsigned = 0L
            var signed = 0L
            for (i in 0 until SIZE) {
                val b = if (i in 148 until 156) ' '.code.toByte() else block[i]
                unsigned += b.toInt() and 0xff
                signed += b.toInt()
            }
            if (stored != unsigned && stored != signed) throw LreException.Corrupt("tar header checksum")
        }

        private fun text(block: ByteArray, offset: Int, length: Int): String {
            var end = offset
            while (end < offset + length && block[end] != 0.toByte()) end++
            return String(block, offset, end - offset, Charsets.UTF_8)
        }

        private fun matches(block: ByteArray, offset: Int, expected: ByteArray): Boolean =
            expected.indices.all { block[offset + it] == expected[it] }

        private val USTAR_MAGIC = "ustar\u0000".toByteArray(Charsets.US_ASCII)
    }
}
