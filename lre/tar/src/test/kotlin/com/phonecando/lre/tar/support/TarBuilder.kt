package com.phonecando.lre.tar.support

import java.io.ByteArrayOutputStream

/** How [TarBuilder] spells names and links longer than the 100-byte header fields. */
enum class LongNames { GNU, PAX, USTAR_PREFIX }

/**
 * Builds tar archives in memory for tests, including shapes real writers
 * never emit (escapes, bad checksums, odd type flags).
 */
class TarBuilder(private val longNames: LongNames = LongNames.GNU) {
    private val out = ByteArrayOutputStream()

    fun file(name: String, text: String, mode: Int = 0b110_100_100, mtime: Long = MTIME) =
        file(name, text.toByteArray(), mode, mtime)

    fun file(name: String, data: ByteArray = ByteArray(0), mode: Int = 0b110_100_100, mtime: Long = MTIME) = apply {
        member(name, '0', data.size.toLong(), mode, mtime)
        data(data)
    }

    fun dir(name: String, mode: Int = 0b111_101_101, mtime: Long = MTIME) = apply {
        member(if (name.endsWith('/')) name else "$name/", '5', 0, mode, mtime)
    }

    fun symlink(name: String, target: String, mtime: Long = MTIME) = apply {
        member(name, '2', 0, 0b111_111_111, mtime, link = target)
    }

    fun hardlink(name: String, target: String) = apply { member(name, '1', 0, 0b110_100_100, MTIME, link = target) }

    /** A header-only member such as a device ('3', '4') or FIFO ('6'). */
    fun special(name: String, type: Char) = apply { member(name, type, 0, 0b110_110_110, MTIME) }

    /** A PAX extended header (per entry, or global with [global]). */
    fun pax(records: Map<String, String>, global: Boolean = false) = apply {
        val body = ByteArrayOutputStream()
        for ((key, value) in records) body.write(paxRecord(key, value))
        val bytes = body.toByteArray()
        header(if (global) "pax_global_header" else "PaxHeaders/x", if (global) 'g' else 'x', bytes.size.toLong())
        data(bytes)
    }

    /** One raw header with exactly these fields; long names are not handled here. */
    fun header(
        name: String,
        type: Char,
        size: Long,
        mode: Int = 0b110_100_100,
        mtime: Long = MTIME,
        link: String = "",
        prefix: String = "",
        base256Size: Boolean = false,
        corruptChecksum: Boolean = false,
    ) = apply {
        val block = ByteArray(BLOCK)
        put(block, 0, 100, name.toByteArray())
        put(block, 100, 8, octal(mode.toLong(), 8))
        put(block, 108, 8, octal(0, 8))
        put(block, 116, 8, octal(0, 8))
        put(block, 124, 12, if (base256Size || size > 0x1_ffff_ffffL) base256(size, 12) else octal(size, 12))
        put(block, 136, 12, octal(mtime, 12))
        block[156] = type.code.toByte()
        put(block, 157, 100, link.toByteArray())
        put(block, 257, 8, "ustar\u000000".toByteArray())
        put(block, 345, 155, prefix.toByteArray())
        for (i in 148 until 156) block[i] = ' '.code.toByte()
        val sum = block.sumOf { it.toInt() and 0xff } + if (corruptChecksum) 1 else 0
        put(block, 148, 8, "%06o\u0000 ".format(sum).toByteArray())
        out.write(block)
    }

    /** Data plus padding to the next block. */
    fun data(bytes: ByteArray) = apply {
        out.write(bytes)
        out.write(ByteArray((BLOCK - bytes.size % BLOCK) % BLOCK))
    }

    fun raw(bytes: ByteArray) = apply { out.write(bytes) }

    /** The archive with its two-block end marker. */
    fun build(endMarker: Boolean = true): ByteArray {
        if (endMarker) out.write(ByteArray(2 * BLOCK))
        return out.toByteArray()
    }

    private fun member(name: String, type: Char, size: Long, mode: Int, mtime: Long, link: String = "") {
        var headerName = name
        var headerLink = link
        var prefix = ""
        val longName = name.toByteArray().size > 100
        val longLink = link.toByteArray().size > 100
        when (longNames) {
            LongNames.GNU -> {
                if (longName) gnuLong('L', name).also { headerName = name.take(100) }
                if (longLink) gnuLong('K', link).also { headerLink = link.take(100) }
            }
            LongNames.PAX -> if (longName || longLink) {
                val records = LinkedHashMap<String, String>()
                if (longName) records["path"] = name.also { headerName = name.take(100) }
                if (longLink) records["linkpath"] = link.also { headerLink = link.take(100) }
                pax(records)
            }
            LongNames.USTAR_PREFIX -> if (longName) {
                val cut = name.lastIndexOf('/', 155)
                prefix = name.substring(0, cut)
                headerName = name.substring(cut + 1)
            }
        }
        header(headerName, type, size, mode, mtime, headerLink, prefix)
    }

    private fun gnuLong(type: Char, text: String) {
        val bytes = text.toByteArray() + 0
        header("././@LongLink", type, bytes.size.toLong())
        data(bytes)
    }

    companion object {
        const val BLOCK = 512
        const val MTIME = 1_700_000_000L

        fun paxRecord(key: String, value: String): ByteArray {
            val body = " $key=$value\n".toByteArray()
            var length = body.size + 1
            while (length.toString().length + body.size != length) length = length.toString().length + body.size
            return "$length".toByteArray() + body
        }

        private fun put(block: ByteArray, offset: Int, length: Int, bytes: ByteArray) {
            require(bytes.size <= length) { "field too long" }
            bytes.copyInto(block, offset)
        }

        private fun octal(value: Long, length: Int): ByteArray =
            (value.toString(8).padStart(length - 1, '0') + "\u0000").toByteArray()

        private fun base256(value: Long, length: Int): ByteArray {
            val bytes = ByteArray(length)
            var v = value
            for (i in length - 1 downTo 1) {
                bytes[i] = (v and 0xff).toByte()
                v = v shr 8
            }
            bytes[0] = 0x80.toByte()
            return bytes
        }
    }
}
