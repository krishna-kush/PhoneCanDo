package com.phonecando.lre.oci.live

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.oci.catalog.HubCatalog
import com.phonecando.lre.oci.http.UrlConnectionTransport
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.registry.RegistryClient
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Against the real Docker Hub; off unless `LRE_LIVE=1` (each run spends one
 * of the anonymous pulls Docker Hub allows per hour).
 */
@EnabledIfEnvironmentVariable(named = "LRE_LIVE", matches = "1")
class LiveDockerHubTest {
    @TempDir
    lateinit var dir: File

    private val transport = UrlConnectionTransport()

    @Test
    fun `resolves alpine latest and downloads its layer`() {
        val client = RegistryClient(transport)
        val started = System.nanoTime()
        val resolved = client.resolve(ImageRef.parse("alpine:latest"))
        val layer = resolved.layers.single()
        var reports = 0
        val file = client.fetchBlob(resolved, layer, dir, ProgressSink { reports++ })
        val millis = (System.nanoTime() - started) / 1_000_000

        assertEquals(layer.size, file.length())
        assertEquals(Compression.GZIP, layer.compression)
        assertTrue(resolved.config.env.any { it.startsWith("PATH=") })
        val base = client.toBaseImage(resolved, dir)
        assertEquals(0x1f, base.layers.single().open().use { it.read() }) // gzip magic
        println(
            "live: ${resolved.ref} -> ${resolved.manifestDigest} via ${resolved.sourceHost}; " +
                "layer ${layer.digest} ${layer.size} bytes; cmd=${resolved.config.cmd}; $reports progress reports; ${millis} ms",
        )
    }

    @Test
    fun `lists official operating systems and arm64 tags`() {
        val catalog = HubCatalog(transport)
        val images = catalog.officialOperatingSystems()
        assertTrue(images.any { it.name == "alpine" } && images.any { it.name == "debian" })
        val tags = catalog.tags("alpine")
        assertEquals("latest", tags.tags.first().name)
        val kali = catalog.tags("kalilinux/kali-rolling")
        assertTrue(kali.tags.any { it.name == "latest" })
        val community = catalog.communityOperatingSystems()
        assertTrue(community.any { it.name == "kalilinux/kali-rolling" && it.logoUrl != null })
        val unofficial = catalog.unofficialOperatingSystems()
        assertTrue(unofficial.images.size > 50 && unofficial.next == 2)
        assertTrue(unofficial.images.none { it.name == "kalilinux/kali-rolling" })
        println("live: ${images.size} official OS images: ${images.joinToString { it.name }}")
        println("live: alpine tags page 1: ${tags.tags.take(8).joinToString { it.name }} ... next=${tags.next}")
        println("live: kali-rolling arm64 tags: ${kali.tags.joinToString { it.name }}")
        println("live: ${community.size} community OS images: ${community.joinToString { it.name }}")
        println("live: unofficial OS page 1: ${unofficial.images.take(8).joinToString { it.name }} ... next=${unofficial.next}")
    }
}
