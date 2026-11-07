package com.phonecando.lre.tar.stream

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import org.tukaani.xz.MemoryLimitException
import org.tukaani.xz.XZInputStream
import java.io.BufferedInputStream
import java.io.IOException
import java.io.InputStream

/** Opens the uncompressed tar bytes of one layer; decoder failures surface as [LreException.Corrupt]. */
internal object LayerStream {
    private const val BUFFER = 64 * 1024

    /** An xz -9 dictionary needs ~65 MiB; a header asking for more is hostile or not ours. */
    private const val XZ_MEMORY_LIMIT_KIB = 256 * 1024

    fun open(source: SourceStream, compression: Compression): InputStream {
        if (compression == Compression.ZSTD) throw LreException.UnsupportedLayer("zstd")
        val buffered = BufferedInputStream(source, BUFFER)
        val decoded = decoding(compression) {
            when (compression) {
                Compression.NONE -> buffered
                Compression.GZIP -> GzipMembersStream(buffered, BUFFER)
                Compression.XZ -> XZInputStream(buffered, XZ_MEMORY_LIMIT_KIB)
                Compression.ZSTD -> error("handled above")
            }
        }
        return DecodedStream(decoded, compression)
    }

    /** Maps one decoder call: our source's failures pass through, everything else is a corrupt layer. */
    private inline fun <T> decoding(compression: Compression, block: () -> T): T = try {
        block()
    } catch (e: SourceReadException) {
        throw e.original
    } catch (e: MemoryLimitException) {
        throw LreException.TooLarge("xz dictionary", XZ_MEMORY_LIMIT_KIB * 1024L)
    } catch (e: IOException) {
        val format = if (compression == Compression.NONE) "tar" else compression.name.lowercase()
        throw LreException.Corrupt("$format layer", e)
    }

    private class DecodedStream(private val inner: InputStream, private val compression: Compression) : InputStream() {
        override fun read(): Int = decoding(compression) { inner.read() }

        override fun read(b: ByteArray, off: Int, len: Int): Int = decoding(compression) { inner.read(b, off, len) }

        override fun close() = inner.close()
    }
}
