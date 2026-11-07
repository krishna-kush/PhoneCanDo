package com.phonecando.lre.tar

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.support.Compress
import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.IOException
import java.io.InputStream
import java.nio.file.Path
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class StreamsTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    /** Incompressible data so cuts in the compressed stream land inside it. */
    private val blob = Random(7).nextBytes(200_000)

    private val archive = TarBuilder()
        .dir("etc")
        .file("etc/os-release", "ID=test\n")
        .file("blob", blob)
        .symlink("link", "/etc/os-release")
        .build()

    private fun assertTree() {
        assertEquals("ID=test\n", guest.text("etc/os-release"))
        assertEquals(blob.toList(), guest.path("blob").toFile().readBytes().toList())
        assertEquals("/etc/os-release", guest.linkTarget("link"))
    }

    @Test
    fun `plain tar`() {
        guest.extract(archive, Compression.NONE)
        assertTree()
    }

    @Test
    fun `gzip`() {
        guest.extract(Compress.gzip(archive), Compression.GZIP)
        assertTree()
    }

    @Test
    fun `multi-member gzip, cut mid-header and mid-data`() {
        guest.extract(Compress.gzipMembers(archive, 700, 1300, 100_000), Compression.GZIP)
        assertTree()
    }

    @Test
    fun `gzip with trailing zero padding`() {
        guest.extract(Compress.gzip(archive) + ByteArray(4096), Compression.GZIP)
        assertTree()
    }

    @Test
    fun `xz`() {
        guest.extract(Compress.xz(archive), Compression.XZ)
        assertTree()
    }

    @Test
    fun `truncated gzip is corrupt`() {
        val gz = Compress.gzip(archive)
        assertFailsWith<LreException.Corrupt> { guest.extract(gz.copyOf(gz.size / 2), Compression.GZIP) }
        assertFailsWith<LreException.Corrupt> { guest.extract(gz.copyOf(gz.size - 4), Compression.GZIP) }
    }

    @Test
    fun `gzip with a bad crc is corrupt`() {
        val gz = Compress.gzip(archive)
        gz[gz.size - 8] = (gz[gz.size - 8] + 1).toByte()
        assertFailsWith<LreException.Corrupt> { guest.extract(gz, Compression.GZIP) }
    }

    @Test
    fun `not gzip at all is corrupt`() {
        assertFailsWith<LreException.Corrupt> { guest.extract(archive, Compression.GZIP) }
        assertFailsWith<LreException.Corrupt> { guest.extract(ByteArray(0), Compression.GZIP) }
    }

    @Test
    fun `truncated xz is corrupt`() {
        val xz = Compress.xz(archive)
        assertFailsWith<LreException.Corrupt> { guest.extract(xz.copyOf(xz.size / 2), Compression.XZ) }
        assertFailsWith<LreException.Corrupt> { guest.extract(xz.copyOf(xz.size - 2), Compression.XZ) }
    }

    @Test
    fun `truncated plain tar is corrupt`() {
        assertFailsWith<LreException.Corrupt> { guest.extract(archive.copyOf(100_000), Compression.NONE) }
        assertFailsWith<LreException.Corrupt> { guest.extract(archive.copyOf(1024 + 100), Compression.NONE) }
    }

    @Test
    fun `zstd is unsupported`() {
        val e = assertFailsWith<LreException.UnsupportedLayer> { guest.extract(archive, Compression.ZSTD) }
        assertEquals("zstd", e.mediaType)
    }

    @Test
    fun `a read failure of the input is not reported as corrupt`() {
        val failure = IOException("disk went away")
        val gz = Compress.gzip(archive)
        val input = object : InputStream() {
            private var pos = 0
            override fun read(): Int = throw UnsupportedOperationException()
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                if (pos >= 5000) throw failure
                val n = minOf(len, 5000 - pos)
                gz.copyInto(b, off, pos, pos + n)
                pos += n
                return n
            }
        }
        val e = assertFailsWith<IOException> {
            TarExtractor().extract(input, Compression.GZIP, guest.dest.toFile())
        }
        assertSame(failure, e)
    }
}
