package com.phonecando.lre.tar.stream

import java.io.IOException
import java.io.InputStream

/**
 * The caller's (compressed) stream: counts the bytes we pull for progress,
 * tags its own read failures so they are not mistaken for a corrupt layer,
 * and is never closed by us (the caller opened it).
 */
internal class SourceStream(private val inner: InputStream) : InputStream() {
    var count = 0L
        private set

    override fun read(): Int = guard { inner.read().also { if (it >= 0) count++ } }

    override fun read(b: ByteArray, off: Int, len: Int): Int =
        guard { inner.read(b, off, len).also { if (it > 0) count += it } }

    override fun available(): Int = guard { inner.available() }

    override fun close() = Unit

    private inline fun <T> guard(block: () -> T): T = try {
        block()
    } catch (e: IOException) {
        throw SourceReadException(e)
    }
}

/** A read failure of the caller's stream itself (disk, network), passed through unchanged. */
internal class SourceReadException(val original: IOException) : IOException(original.message, original)
