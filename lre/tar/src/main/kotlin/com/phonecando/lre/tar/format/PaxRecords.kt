package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException
import java.nio.file.attribute.FileTime
import java.time.Instant

/** PAX extended header records: `<length> <key>=<value>\n`, the length counting the whole record. */
internal object PaxRecords {
    const val PATH = "path"
    const val LINK_PATH = "linkpath"
    const val SIZE = "size"
    const val MTIME = "mtime"
    const val SPARSE_PREFIX = "GNU.sparse."

    fun parse(bytes: ByteArray): Map<String, String> {
        val records = LinkedHashMap<String, String>()
        var pos = 0
        while (pos < bytes.size && bytes[pos] != 0.toByte()) {
            var space = pos
            while (space < bytes.size && bytes[space] != ' '.code.toByte()) space++
            val length = decimal(bytes, pos, space) ?: throw corrupt()
            if (length <= space - pos + 1 || length > bytes.size - pos) throw corrupt()
            val end = pos + length.toInt()
            if (bytes[end - 1] != '\n'.code.toByte()) throw corrupt()
            var equals = space + 1
            while (equals < end - 1 && bytes[equals] != '='.code.toByte()) equals++
            if (equals >= end - 1) throw corrupt()
            val key = String(bytes, space + 1, equals - space - 1, Charsets.UTF_8)
            records[key] = String(bytes, equals + 1, end - 1 - equals - 1, Charsets.UTF_8)
            pos = end
        }
        return records
    }

    /** A global header updates the running set; an empty value removes the key. */
    fun applyGlobal(globals: MutableMap<String, String>, records: Map<String, String>) {
        for ((key, value) in records) if (value.isEmpty()) globals.remove(key) else globals[key] = value
    }

    fun parseSize(value: String): Long =
        value.toByteArray(Charsets.US_ASCII).let { decimal(it, 0, it.size) } ?: throw corrupt()

    /** `<seconds>[.<fraction>]`, possibly negative; null when malformed (the header's mtime applies). */
    fun parseTime(value: String): FileTime? {
        val match = TIME.matchEntire(value) ?: return null
        val seconds = match.groupValues[1].toLongOrNull() ?: return null
        val nanos = match.groupValues[2].take(9).padEnd(9, '0').toLong()
        // "-1.5" is one and a half seconds before the epoch: the fraction shares the sign.
        val signedNanos = if (match.groupValues[1].startsWith("-")) -nanos else nanos
        return FileTime.from(Instant.ofEpochSecond(seconds, signedNanos))
    }

    private fun decimal(bytes: ByteArray, from: Int, to: Int): Long? {
        if (from >= to) return null
        var value = 0L
        for (i in from until to) {
            val digit = bytes[i] - '0'.code.toByte()
            if (digit !in 0..9 || value > (Long.MAX_VALUE - digit) / 10) return null
            value = value * 10 + digit
        }
        return value
    }

    private fun corrupt() = LreException.Corrupt("tar pax header")

    private val TIME = Regex("""(-?\d+)(?:\.(\d*))?""")
}
