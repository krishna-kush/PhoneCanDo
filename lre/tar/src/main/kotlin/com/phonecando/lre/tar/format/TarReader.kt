package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException
import java.io.InputStream
import java.nio.file.attribute.FileTime
import java.util.concurrent.TimeUnit

/**
 * Reads the members of an uncompressed tar stream strictly forward, folding
 * GNU long names and PAX headers into the entry they describe. The data of
 * the entry [next] returned last is [content]; the next [next] call skips
 * whatever of it was not read.
 */
internal class TarReader(private val input: InputStream, private val maxPathBytes: Int) {
    private val block = ByteArray(HeaderBlock.SIZE)
    private val scratch = ByteArray(SKIP_BUFFER)
    private val globals = HashMap<String, String>()
    private var remaining = 0L
    private var padding = 0

    /** Data of the current entry; ends (-1) at the entry's size, fails if the stream ends first. */
    val content: InputStream = object : InputStream() {
        override fun read(): Int {
            val one = ByteArray(1)
            return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 0xff
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (remaining <= 0) return -1
            if (len == 0) return 0
            val n = input.read(b, off, minOf(len.toLong(), remaining).toInt())
            if (n < 0) throw LreException.Corrupt("tar entry (truncated)")
            remaining -= n
            return n
        }
    }

    /** The next member, or null at the end-of-archive marker (or a clean EOF between members). */
    fun next(): TarEntry? {
        discard(remaining)
        remaining = 0
        discard(padding.toLong())
        padding = 0
        var longName: String? = null
        var longLink: String? = null
        var pax: Map<String, String> = emptyMap()
        var pendingMeta = false
        while (true) {
            if (!readBlock() || HeaderBlock.isZero(block)) {
                if (pendingMeta) throw LreException.Corrupt("tar extended header without a member")
                return null
            }
            val header = HeaderBlock.parse(block)
            when (header.type) {
                TypeFlags.GNU_LONG_NAME -> longName = metaText(header.size)
                TypeFlags.GNU_LONG_LINK -> longLink = metaText(header.size)
                TypeFlags.PAX, TypeFlags.PAX_SOLARIS -> pax = PaxRecords.parse(meta(header.size, MAX_PAX_BYTES, "tar pax header"))
                TypeFlags.PAX_GLOBAL -> {
                    PaxRecords.applyGlobal(globals, PaxRecords.parse(meta(header.size, MAX_PAX_BYTES, "tar pax header")))
                    continue
                }
                else -> return entry(header, longName, longLink, pax)
            }
            pendingMeta = true
        }
    }

    /** Reads (and checks) what follows the end marker, so the decoder verifies its trailer. */
    fun drain() {
        var left = MAX_TRAILER_BYTES
        while (left > 0) {
            val n = input.read(scratch, 0, minOf(scratch.size.toLong(), left).toInt())
            if (n < 0) return
            left -= n
        }
    }

    private fun entry(header: HeaderBlock, longName: String?, longLink: String?, pax: Map<String, String>): TarEntry {
        fun value(key: String): String? = (if (key in pax) pax[key] else globals[key])?.takeIf { it.isNotEmpty() }
        val sparse = { key: String -> key.startsWith(PaxRecords.SPARSE_PREFIX) }
        if (pax.keys.any(sparse) || globals.keys.any(sparse)) {
            throw LreException.UnsupportedLayer("tar sparse file")
        }
        val name = value(PaxRecords.PATH) ?: longName ?: header.name
        val size = value(PaxRecords.SIZE)?.let(PaxRecords::parseSize) ?: header.size
        if (size < 0) throw LreException.Corrupt("tar size field")
        val dataSize = if (TypeFlags.hasData(header.type)) size else 0L
        remaining = dataSize
        padding = padOf(dataSize)
        return TarEntry(
            name = name,
            kind = TypeFlags.kindOf(header.type, name),
            linkName = value(PaxRecords.LINK_PATH) ?: longLink ?: header.linkName,
            size = dataSize,
            mode = header.mode,
            mtime = value(PaxRecords.MTIME)?.let(PaxRecords::parseTime) ?: FileTime.from(header.mtime, TimeUnit.SECONDS),
        )
    }

    /** A GNU long name or link: NUL-terminated text no longer than a path may be. */
    private fun metaText(size: Long): String {
        if (size > maxPathBytes + 1L) throw LreException.TooLarge("entry path", maxPathBytes.toLong())
        val bytes = meta(size, size, "tar long name")
        val end = bytes.indexOf(0.toByte()).let { if (it < 0) bytes.size else it }
        return String(bytes, 0, end, Charsets.UTF_8)
    }

    private fun meta(size: Long, cap: Long, what: String): ByteArray {
        if (size > cap) throw LreException.TooLarge(what, cap)
        val bytes = ByteArray(size.toInt())
        readFully(bytes, bytes.size, what)
        discard(padOf(size).toLong())
        return bytes
    }

    /** False on EOF before the first byte; a partial block is a truncated archive. */
    private fun readBlock(): Boolean {
        val first = input.read(block, 0, block.size)
        if (first < 0) return false
        if (first < block.size) readFully(block, block.size, "tar header", from = first)
        return true
    }

    private fun readFully(into: ByteArray, length: Int, what: String, from: Int = 0) {
        var off = from
        while (off < length) {
            val n = input.read(into, off, length - off)
            if (n < 0) throw LreException.Corrupt("$what (truncated)")
            off += n
        }
    }

    private fun discard(count: Long) {
        var left = count
        while (left > 0) {
            val n = input.read(scratch, 0, minOf(scratch.size.toLong(), left).toInt())
            if (n < 0) throw LreException.Corrupt("tar entry (truncated)")
            left -= n
        }
    }

    private fun padOf(size: Long): Int = ((HeaderBlock.SIZE - size % HeaderBlock.SIZE) % HeaderBlock.SIZE).toInt()

    private companion object {
        const val SKIP_BUFFER = 64 * 1024
        const val MAX_PAX_BYTES = 1L shl 20

        /** GNU tar pads to 10 KiB records; anything much past that we leave unread. */
        const val MAX_TRAILER_BYTES = 1L shl 20
    }
}
