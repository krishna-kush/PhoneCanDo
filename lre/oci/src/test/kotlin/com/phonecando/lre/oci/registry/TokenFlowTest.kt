package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.testkit.FakeRegistry
import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.Fixtures
import com.phonecando.lre.oci.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TokenFlowTest {
    private val fake = FakeTransport()
    private val hub = FakeRegistry(fake, ImageRef.DOCKER_HUB, "library/alpine").apply {
        manifestFixture("latest", "registry/alpine-index.json", Fixtures.OCI_INDEX)
        manifestFixture(null, "registry/alpine-arm64-manifest.json", Fixtures.OCI_MANIFEST)
        blob(Fixtures.bytes("registry/alpine-arm64-config.json"))
    }
    private var now = 0L
    private val client = RegistryClient(fake, Mirrors.NONE, RetryPolicy(sleeper = {}), nowMillis = { now })

    @Test
    fun `401 fetches one anonymous token, retries, then reuses it`() {
        client.resolve(ImageRef.parse("alpine"))

        assertEquals(1, hub.tokenFetches)
        assertEquals(1, hub.unauthorized)
        val first = fake.requests.first()
        assertNull(first.header("Authorization"))
        val tokenRequest = fake.requestsTo("https://auth.docker.io/token").single()
        assertEquals(
            "https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Falpine%3Apull",
            tokenRequest.url,
        )
        assertNull(tokenRequest.header("Authorization"))
        // index, arm64 manifest and config blob all went out with the cached token
        val signed = fake.requestsTo(hub.base).filter { it.header("Authorization") == "Bearer ${hub.token}" }
        assertEquals(3, signed.size)
    }

    @Test
    fun `an expired token is fetched again`() {
        client.resolve(ImageRef.parse("alpine"))
        now += 10 * 60 * 1000
        client.resolve(ImageRef.parse("alpine"))
        assertEquals(2, hub.tokenFetches)
        assertEquals(2, hub.unauthorized)
    }

    @Test
    fun `a second 401 means missing or private`() {
        hub.outage = { reply(401, Fixtures.bytes("registry/unauthorized.json"), mapOf("WWW-Authenticate" to """Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/alpine:pull"""")) }
        assertThrows<LreException.NotFound> { client.resolve(ImageRef.parse("alpine")) }
        assertEquals(1, hub.tokenFetches)
    }

    @Test
    fun `a 401 without a Bearer challenge is a login we lack`() {
        hub.outage = { reply(401, "", mapOf("WWW-Authenticate" to """Basic realm="Registry"""")) }
        assertThrows<LreException.NotFound> { client.resolve(ImageRef.parse("alpine")) }
        assertEquals(0, hub.tokenFetches)
    }

    @Test
    fun `errors never carry the token`() {
        client.resolve(ImageRef.parse("alpine")) // caches the token
        hub.outage = { reply(503, "down") }
        val e = assertThrows<LreException.Network> { client.resolve(ImageRef.parse("alpine")) }
        assertEquals(503, e.status)
        val text = generateSequence<Throwable>(e) { it.cause }.joinToString { it.toString() }
        assertFalse(text.contains(hub.token))
        assertFalse(text.contains("SECRET"))
        assertTrue(e.url.startsWith("https://registry-1.docker.io/v2/library/alpine/manifests/"))
    }

    @Test
    fun `a token realm over plain http is refused for a remote registry`() {
        hub.outage = { reply(401, "", mapOf("WWW-Authenticate" to """Bearer realm="http://auth.docker.io/token",service="registry.docker.io"""")) }
        assertThrows<LreException.Network> { client.resolve(ImageRef.parse("alpine")) }
        assertEquals(0, hub.tokenFetches)
    }
}
