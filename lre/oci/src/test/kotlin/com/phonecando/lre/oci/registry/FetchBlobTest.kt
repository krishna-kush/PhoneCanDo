package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.testkit.FakeRegistry
import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.Synthetic
import com.phonecando.lre.oci.testkit.brokenReply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FetchBlobTest {
    @TempDir
    lateinit var dir: File

    private val fake = FakeTransport()
    private val registry = FakeRegistry(fake, "ghcr.io", "owner/os")
    private val layerBytes = Synthetic.serveImage(registry, "1", Synthetic.bytes(700_000))
    private val sleeps = mutableListOf<Long>()
    private val client = RegistryClient(fake, Mirrors.NONE, RetryPolicy(sleeper = { sleeps += it }))
    private val resolved = client.resolve(ImageRef.parse("ghcr.io/owner/os:1"))
    private val layer = resolved.layers.single()
    private val hex = layer.digest.removePrefix("sha256:")

    /** CDN requests for the layer (the config blob comes from the CDN too). */
    private fun cdnRequests() = fake.requestsTo(registry.cdn + layer.digest.replace(':', '/'))

    @Test
    fun `downloads, verifies and names the blob by digest`() {
        val progress = mutableListOf<Progress>()
        val file = client.fetchBlob(resolved, layer, dir, ProgressSink { progress += it })

        assertEquals(File(dir, "sha256-$hex"), file)
        assertContentEquals(layerBytes, file.readBytes())
        assertFalse(File(dir, "sha256-$hex.part").exists())
        assertTrue(progress.all { it.step == "download" && it.total == 700_000L })
        assertEquals(700_000, progress.last().done)
        assertTrue(progress.map { it.done }.zipWithNext().all { (a, b) -> a <= b })
        assertEquals(null, cdnRequests().single().header("Authorization"))
    }

    @Test
    fun `resumes a partial download with Range`() {
        File(dir, "sha256-$hex.part").writeBytes(layerBytes.copyOf(300_000))
        val file = client.fetchBlob(resolved, layer, dir)

        assertContentEquals(layerBytes, file.readBytes())
        assertEquals("bytes=300000-", cdnRequests().single().header("Range"))
    }

    @Test
    fun `a server that ignores Range gets a fresh download`() {
        registry.ignoreRange = true
        File(dir, "sha256-$hex.part").writeBytes(layerBytes.copyOf(300_000))
        val file = client.fetchBlob(resolved, layer, dir)
        assertContentEquals(layerBytes, file.readBytes())
    }

    @Test
    fun `a partial that is not this blob is thrown away`() {
        File(dir, "sha256-$hex.part").writeBytes(ByteArray(700_000)) // full size, wrong bytes
        val file = client.fetchBlob(resolved, layer, dir)
        assertContentEquals(layerBytes, file.readBytes())
        assertEquals(null, cdnRequests().single().header("Range"))
    }

    @Test
    fun `a digest mismatch deletes the partial`() {
        val tampered = layerBytes.copyOf().also { it[123] = (it[123] + 1).toByte() }
        registry.blob(tampered, digest = layer.digest)
        val e = assertThrows<LreException.DigestMismatch> { client.fetchBlob(resolved, layer, dir) }
        assertEquals(layer.digest, e.expected)
        assertFalse(File(dir, "sha256-$hex.part").exists())
        assertFalse(File(dir, "sha256-$hex").exists())
    }

    @Test
    fun `an existing complete file is re-verified and reused`() {
        File(dir, "sha256-$hex").writeBytes(layerBytes)
        val requestsBefore = fake.requests.size
        val progress = mutableListOf<Progress>()
        val file = client.fetchBlob(resolved, layer, dir, ProgressSink { progress += it })
        assertContentEquals(layerBytes, file.readBytes())
        assertEquals(requestsBefore, fake.requests.size)
        assertEquals(Progress("download", 700_000, 700_000), progress.single())
    }

    @Test
    fun `a corrupt existing file is downloaded again`() {
        File(dir, "sha256-$hex").writeBytes(ByteArray(700_000))
        val file = client.fetchBlob(resolved, layer, dir)
        assertContentEquals(layerBytes, file.readBytes())
        assertEquals(1, cdnRequests().size)
    }

    @Test
    fun `a dropped connection resumes where it broke`() {
        var drops = 1
        registry.cdnOutage = { request ->
            if (drops-- > 0) brokenReply(200, layerBytes.copyOf(400_000)) else null
        }
        val file = client.fetchBlob(resolved, layer, dir)
        assertContentEquals(layerBytes, file.readBytes())
        val ranges = cdnRequests().map { it.header("Range") }
        assertEquals(listOf(null, "bytes=400000-"), ranges)
        assertEquals(1_000L, sleeps.sum()) // one retry after the base pause
    }

    @Test
    fun `cancelling keeps the partial for later`() {
        var done = 0L
        val cancel = CancelSignal { done > 0 }
        assertThrows<LreException.Cancelled> {
            client.fetchBlob(resolved, layer, dir, ProgressSink { done = it.done }, cancel)
        }
        val kept = File(dir, "sha256-$hex.part").length()
        assertTrue(kept in 1 until 700_000)
        val file = client.fetchBlob(resolved, layer, dir)
        assertContentEquals(layerBytes, file.readBytes())
        assertEquals("bytes=$kept-", cdnRequests().last().header("Range"))
    }

    @Test
    fun `only sha256 digests are fetched`() {
        val e = assertThrows<LreException.UnsupportedLayer> {
            client.fetchBlob(resolved, layer.copy(digest = "sha512:" + "ab".repeat(64)), dir)
        }
        assertTrue(e.mediaType.contains("sha512"))
        assertThrows<LreException.Corrupt> { client.fetchBlob(resolved, layer.copy(digest = "sha256:../../etc"), dir) }
    }

    @Test
    fun `toBaseImage opens the downloaded files`() {
        assertThrows<LreException.NotFound> { client.toBaseImage(resolved, dir) }
        client.fetchBlob(resolved, layer, dir)
        val base = client.toBaseImage(resolved, dir)
        assertEquals(resolved.config, base.config)
        val opened = base.layers.single()
        assertEquals(Compression.GZIP, opened.compression)
        assertEquals(700_000L, opened.size)
        assertContentEquals(layerBytes, opened.open().use { it.readBytes() })
    }
}
