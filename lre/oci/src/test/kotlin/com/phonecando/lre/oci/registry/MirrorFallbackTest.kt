package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.testkit.FakeRegistry
import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.Fixtures
import com.phonecando.lre.oci.testkit.Synthetic
import com.phonecando.lre.oci.testkit.noResponse
import com.phonecando.lre.oci.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MirrorFallbackTest {
    @TempDir
    lateinit var dir: File

    private val fake = FakeTransport()
    private val hub = alpineOn(FakeRegistry(fake, ImageRef.DOCKER_HUB, "library/alpine"))
    private val ecr = alpineOn(FakeRegistry(fake, "public.ecr.aws", "docker/library/alpine", FakeRegistry.Auth.ECR))
    private val gcr = alpineOn(FakeRegistry(fake, "mirror.gcr.io", "library/alpine", auth = null))
    private val sleeps = mutableListOf<Long>()
    private val client = RegistryClient(fake, Mirrors.default, RetryPolicy(sleeper = { sleeps += it }))

    private fun alpineOn(registry: FakeRegistry) = registry.apply {
        manifestFixture("latest", "registry/alpine-index.json", Fixtures.OCI_INDEX)
        manifestFixture(null, "registry/alpine-arm64-manifest.json", Fixtures.OCI_MANIFEST)
        blob(Fixtures.bytes("registry/alpine-arm64-config.json"))
    }

    private fun status(code: Int) = { _: com.phonecando.lre.oci.testkit.Request -> reply(code, "") }

    @Test
    fun `Docker Hub 429 falls back to ECR at once`() {
        hub.outage = status(429)
        val resolved = client.resolve(ImageRef.parse("alpine"))

        assertEquals("public.ecr.aws", resolved.sourceHost)
        assertEquals(Fixtures.ALPINE_ARM64, resolved.manifestDigest)
        assertEquals(1, fake.requestsTo(hub.base).size)
        assertTrue(sleeps.isEmpty())
        assertEquals(
            "https://public.ecr.aws/token/?service=public.ecr.aws&scope=aws",
            fake.requestsTo("https://public.ecr.aws/token/").single().url,
        )
        assertTrue(fake.requestsTo(ecr.base).first().url.endsWith("/v2/docker/library/alpine/manifests/latest"))
    }

    @Test
    fun `Docker Hub 503 is retried with capped backoff, then ECR`() {
        hub.outage = status(503)
        val resolved = client.resolve(ImageRef.parse("alpine"))

        assertEquals("public.ecr.aws", resolved.sourceHost)
        assertEquals(3, fake.requestsTo(hub.base).size)
        assertEquals(1_000L + 2_000L, sleeps.sum())
        assertTrue(sleeps.all { it <= 250 })
    }

    @Test
    fun `no response from Docker Hub counts like a 5xx`() {
        hub.outage = { noResponse() }
        assertEquals("public.ecr.aws", client.resolve(ImageRef.parse("alpine")).sourceHost)
        assertEquals(3, fake.requestsTo(hub.base).size)
    }

    @Test
    fun `when ECR fails too, Google's mirror serves`() {
        hub.outage = status(429)
        ecr.outage = status(503)
        assertEquals("mirror.gcr.io", client.resolve(ImageRef.parse("alpine")).sourceHost)
    }

    @Test
    fun `everything failing after a 429 reports the rate limit`() {
        hub.outage = status(429)
        ecr.outage = status(404)
        gcr.outage = status(503)
        val e = assertThrows<LreException.RateLimited> { client.resolve(ImageRef.parse("alpine")) }
        assertEquals("https://registry-1.docker.io/v2/library/alpine/manifests/latest", e.url)
    }

    @Test
    fun `a tag Docker Hub does not have is final`() {
        assertThrows<LreException.NotFound> { client.resolve(ImageRef.parse("alpine:9.99")) }
        assertTrue(fake.requestsTo(ecr.base).isEmpty())
        assertTrue(fake.requestsTo(gcr.base).isEmpty())
    }

    @Test
    fun `images outside library have no mirrors`() {
        val kali = FakeRegistry(fake, ImageRef.DOCKER_HUB, "kalilinux/kali-rolling")
        kali.outage = status(429)
        assertThrows<LreException.RateLimited> { client.resolve(ImageRef.parse("kalilinux/kali-rolling")) }
        assertEquals(1, fake.requests.size)
    }

    @Test
    fun `blob downloads fall back too, by digest`() {
        val layer = Synthetic.bytes(50_000, seed = 7)
        listOf(hub, ecr, gcr).forEach { Synthetic.serveImage(it, "3.22", layer) }
        val resolved = client.resolve(ImageRef.parse("alpine:3.22"))
        assertEquals(ImageRef.DOCKER_HUB, resolved.sourceHost)

        hub.outage = { if (it.url.contains("/blobs/")) reply(429, "") else null }
        val file = client.fetchBlob(resolved, resolved.layers.single(), dir)
        assertContentEquals(layer, file.readBytes())
        assertEquals(1, fake.requestsTo(ecr.cdn + resolved.layers.single().digest.replace(':', '/')).size)
    }

    @Test
    fun `blob downloads start at the host that served the manifest`() {
        val layer = Synthetic.bytes(10_000, seed = 9)
        listOf(hub, ecr, gcr).forEach { Synthetic.serveImage(it, "3.22", layer) }
        hub.outage = status(429)
        val resolved = client.resolve(ImageRef.parse("alpine:3.22"))
        val hubRequests = fake.requestsTo(hub.base).size

        client.fetchBlob(resolved, resolved.layers.single(), dir)
        assertEquals(hubRequests, fake.requestsTo(hub.base).size)
        assertEquals(1, fake.requestsTo(ecr.cdn + resolved.layers.single().digest.replace(':', '/')).size)
    }
}
