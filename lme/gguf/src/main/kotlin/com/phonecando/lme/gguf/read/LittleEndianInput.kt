package com.phonecando.lme.gguf.read

import com.phonecando.lme.api.LmeException
import java.io.EOFException
import java.io.InputStream

/**
 * Little-endian reads over a stream with a byte budget: reading past
 * [limit] bytes is [LmeException.TooLarge], a stream that ends early is
 * [LmeException.InvalidGguf]. IO errors pass through.
 */
internal class LittleEndianInput(private val input: InputStream, private val limit: Long) {
    var position = 0L
        private set
    private val scratch = ByteArray(8)

    fun u8(): Int {
        fill(scratch, 1)
        return scratch[0].toInt() and 0xff
    }

    fun u16(): Int {
        fill(scratch, 2)
        return (scratch[0].toInt() and 0xff) or ((scratch[1].toInt() and 0xff) shl 8)
    }

    fun u32(): Long {
        fill(scratch, 4)
        var v = 0L
        for (i in 3 downTo 0) v = (v shl 8) or (scratch[i].toLong() and 0xff)
        return v
    }

    /** Raw 64 bits: negative when the unsigned value is above [Long.MAX_VALUE]. */
    fun u64(): Long {
        fill(scratch, 8)
        var v = 0L
        for (i in 7 downTo 0) v = (v shl 8) or (scratch[i].toLong() and 0xff)
        return v
    }

    fun bytes(n: Int): ByteArray = ByteArray(n).also { fill(it, n) }

    fun skip(n: Long) {
        budget(n)
        var left = n
        while (left > 0) {
            val skipped = input.skip(left)
            if (skipped > 0) {
                left -= skipped
                continue
            }
            // skip() may give up without being at the end; one read tells.
            if (input.read() < 0) throw truncated()
            left--
        }
        position += n
    }

    private fun fill(buffer: ByteArray, n: Int) {
        budget(n.toLong())
        var off = 0
        while (off < n) {
            val read = try {
                input.read(buffer, off, n - off)
            } catch (_: EOFException) {
                -1
            }
            if (read < 0) throw truncated()
            off += read
        }
        position += n
    }

    private fun budget(n: Long) {
        if (n < 0 || n > limit - position) throw LmeException.TooLarge("GGUF header", limit)
    }

    private fun truncated() = LmeException.InvalidGguf("the file ends inside its header")
}
