package com.phonecando.lme.store.download

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.Progress
import com.phonecando.lme.api.ProgressSink
import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.reply
import com.phonecando.lme.store.support.Served
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FileDownloaderTest {
    @TempDir
    lateinit var dir: File

    private val url = "https://cdn.example/m.gguf"
    private val data = ByteArray(5000) { (it * 7).toByte() }
    private val fake = FakePort()
    private val part get() = File(dir, "m.gguf.part")
    private val target get() = File(dir, "m.gguf")
    private val reports = mutableListOf<Progress>()

    private fun file(served: Served, size: Long = data.size.toLong()) = RemoteFile("m.gguf", url, size, served.sha256)

    private fun run(served: Served, file: RemoteFile = file(served), cancel: CancelSignal = CancelSignal.NEVER) =
        FileDownloader(fake, mapOf("X-Test" to "1")).download(file, part, target, 100, 100 + data.size.toLong(), ProgressSink { reports += it }, cancel)

    @Test
    fun `a fresh download is verified, then renamed`() {
        val served = Served(data)
        fake.on(url, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
        assertFalse(part.exists())
        assertNull(fake.requests.single().header("range"))
        assertEquals("1", fake.requests.single().header("x-test"))
        assertEquals(Progress("download", 100 + 5000L, 5100), reports.last())
    }

    @Test
    fun `a partial file resumes with Range`() {
        val served = Served(data)
        part.writeBytes(data.copyOf(1234))
        fake.on(url, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
        assertEquals("bytes=1234-", fake.requests.single().header("range"))
        assertTrue(reports.any { it.step == "verify" })
    }

    @Test
    fun `a broken body keeps what arrived, and the next run finishes it`() {
        val broken = Served(data, breakAfter = 3000)
        fake.on(url, broken::answer)
        assertThrows<LmeException.Network> { run(broken) }
        assertEquals(3000, part.length())
        assertFalse(target.exists())

        val good = Served(data)
        fake.on(url, good::answer)
        run(good)
        assertContentEquals(data, target.readBytes())
        assertEquals("bytes=3000-", fake.requests.last().header("range"))
    }

    @Test
    fun `a server that ignores Range starts over`() {
        val served = Served(data, ignoreRange = true)
        part.writeBytes(data.copyOf(1000))
        fake.on(url, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
    }

    @Test
    fun `416 means our partial is not their file`() {
        val served = Served(data)
        part.writeBytes(ByteArray(10))
        fake.on(url, { reply(416) }, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
        assertEquals(listOf("bytes=10-", null), fake.requests.map { it.header("range") })
    }

    @Test
    fun `a range answered from another offset drops the partial`() {
        val served = Served(data)
        part.writeBytes(data.copyOf(100))
        fake.on(url, { reply(206, data, mapOf("Content-Range" to "bytes 0-4999/5000")) })
        assertThrows<LmeException.Network> { run(served) }
        assertFalse(part.exists())
    }

    @Test
    fun `a wrong digest deletes the partial`() {
        val served = Served(data)
        fake.on(url, served::answer)
        val e = assertThrows<LmeException.DigestMismatch> { run(served, RemoteFile("m.gguf", url, 5000, "0".repeat(64))) }
        assertEquals(served.sha256, e.actual)
        assertFalse(part.exists())
        assertFalse(target.exists())
    }

    @Test
    fun `more bytes than promised deletes the partial`() {
        val served = Served(data)
        fake.on(url, served::answer)
        assertThrows<LmeException.SizeMismatch> { run(served, RemoteFile("m.gguf", url, 4000, served.sha256)) }
        assertFalse(part.exists())
    }

    @Test
    fun `a body that ends early is a network error`() {
        val served = Served(data)
        fake.on(url, { reply(200, data.copyOf(10)) })
        assertThrows<LmeException.Network> { run(served) }
        assertEquals(10, part.length())
    }

    @Test
    fun `a complete partial that verifies needs no request, one that does not is fetched again`() {
        val served = Served(data)
        part.writeBytes(data)
        run(served)
        assertTrue(fake.requests.isEmpty())
        assertContentEquals(data, target.readBytes())

        target.delete()
        part.writeBytes(ByteArray(data.size))
        fake.on(url, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
        assertNull(fake.requests.single().header("range"))
    }

    @Test
    fun `a partial longer than the file is dropped`() {
        val served = Served(data)
        part.writeBytes(ByteArray(6000))
        fake.on(url, served::answer)
        run(served)
        assertContentEquals(data, target.readBytes())
    }

    @Test
    fun `cancel stops and keeps the partial`() {
        val served = Served(data)
        fake.on(url, served::answer)
        assertThrows<LmeException.Cancelled> { run(served, cancel = CancelSignal { true }) }
        assertTrue(part.exists())
    }

    @Test
    fun `statuses become typed errors and nothing is written`() {
        val served = Served(data)
        fake.on(url, { reply(404) }, { reply(401) }, { reply(204) }, { reply(500) })
        assertThrows<LmeException.NotFound> { run(served) }
        assertThrows<LmeException.AccessDenied> { run(served) }
        assertThrows<LmeException.Network> { run(served) }
        assertThrows<LmeException.Network> { run(served) }
        assertFalse(part.exists())
    }
}
