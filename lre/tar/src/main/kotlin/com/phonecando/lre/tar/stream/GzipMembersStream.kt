package com.phonecando.lre.tar.stream

import java.io.EOFException
import java.io.InputStream
import java.util.zip.CRC32
import java.util.zip.DataFormatException
import java.util.zip.Inflater
import java.util.zip.ZipException

/**
 * Gzip decoder that reads every member of a multi-member stream until EOF.
 * java.util.zip.GZIPInputStream decides whether another member follows from
 * available(), which a network stream may report as 0 at a member boundary:
 * that would cut the layer short without an error. Trailing bytes that do
 * not start a member are ignored, as gzip(1) does.
 */
internal class GzipMembersStream(private val input: InputStream, bufferSize: Int) : InputStream() {
    private val buf = ByteArray(bufferSize)
    private var pos = 0
    private var limit = 0
    private val inflater = Inflater(true)
    private val crc = CRC32()
    private var memberBytes = 0L
    private var eof = false

    init {
        if (readByte() != MAGIC1 || readByte() != MAGIC2) throw ZipException("not in gzip format")
        readHeaderAfterMagic()
    }

    override fun read(): Int {
        val one = ByteArray(1)
        return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 0xff
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (len == 0) return 0
        while (!eof) {
            if (inflater.finished()) {
                finishMember()
                continue
            }
            if (inflater.needsInput()) {
                if (pos >= limit && !refill()) throw EOFException("truncated gzip member")
                inflater.setInput(buf, pos, limit - pos)
                pos = limit // the inflater owns these bytes until it finishes or needs more
            }
            val n = try {
                inflater.inflate(b, off, len)
            } catch (e: DataFormatException) {
                throw ZipException(e.message ?: "bad deflate data")
            }
            if (n > 0) {
                crc.update(b, off, n)
                memberBytes += n
                return n
            }
            if (inflater.needsDictionary()) throw ZipException("deflate dictionary in gzip")
        }
        return -1
    }

    override fun close() {
        inflater.end()
        input.close()
    }

    private fun finishMember() {
        pos = limit - inflater.remaining
        val storedCrc = readIntLe()
        val storedSize = readIntLe()
        if (storedCrc != crc.value.toInt()) throw ZipException("gzip crc mismatch")
        if (storedSize != memberBytes.toInt()) throw ZipException("gzip size mismatch")
        val first = readByteOrEof()
        if (first < 0) {
            eof = true
            return
        }
        val second = readByteOrEof()
        if (first == MAGIC1 && second < 0) throw EOFException("truncated gzip member")
        if (first != MAGIC1 || second != MAGIC2) {
            eof = true
            return
        }
        readHeaderAfterMagic()
        inflater.reset()
        crc.reset()
        memberBytes = 0
    }

    /** RFC 1952 member header after the two magic bytes. */
    private fun readHeaderAfterMagic() {
        if (readByte() != METHOD_DEFLATE) throw ZipException("unsupported gzip method")
        val flags = readByte()
        if (flags and FLAG_RESERVED != 0) throw ZipException("reserved gzip flags")
        repeat(6) { readByte() } // mtime, extra flags, os
        if (flags and FLAG_EXTRA != 0) repeat(readByte() or (readByte() shl 8)) { readByte() }
        if (flags and FLAG_NAME != 0) while (readByte() != 0) Unit
        if (flags and FLAG_COMMENT != 0) while (readByte() != 0) Unit
        if (flags and FLAG_HEADER_CRC != 0) repeat(2) { readByte() }
    }

    private fun readIntLe(): Int = readByte() or (readByte() shl 8) or (readByte() shl 16) or (readByte() shl 24)

    private fun readByte(): Int = readByteOrEof().also { if (it < 0) throw EOFException("truncated gzip member") }

    private fun readByteOrEof(): Int {
        if (pos >= limit && !refill()) return -1
        return buf[pos++].toInt() and 0xff
    }

    private fun refill(): Boolean {
        val n = input.read(buf, 0, buf.size)
        if (n <= 0) return false
        pos = 0
        limit = n
        return true
    }

    private companion object {
        const val MAGIC1 = 0x1f
        const val MAGIC2 = 0x8b
        const val METHOD_DEFLATE = 8
        const val FLAG_HEADER_CRC = 0x02
        const val FLAG_EXTRA = 0x04
        const val FLAG_NAME = 0x08
        const val FLAG_COMMENT = 0x10
        const val FLAG_RESERVED = 0xe0
    }
}
