package com.phonecando.network.http

import com.phonecando.network.NetException
import com.phonecando.network.testkit.FakePort
import com.phonecando.network.testkit.brokenReply
import com.phonecando.network.testkit.noResponse
import com.phonecando.network.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

class HttpCallsTest {
    private val url = "https://user:pw@huggingface.co/api/models?search=x&token=secret"

    @Test
    fun `status codes map to typed errors without secrets`() {
        assertIs<NetException.AccessDenied>(errorFor(reply(401), url, "repo"))
        assertIs<NetException.AccessDenied>(errorFor(reply(403), url, "repo"))
        assertIs<NetException.NotFound>(errorFor(reply(404), url, "repo"))
        assertIs<NetException.NotFound>(errorFor(reply(410), url, "repo"))
        val limited = assertIs<NetException.RateLimited>(errorFor(reply(429), url, "repo"))
        assertEquals("https://huggingface.co/api/models", limited.url)
        assertNull(limited.retryAfterSeconds)
        val other = assertIs<NetException.Network>(errorFor(reply(500), url, "repo"))
        assertEquals(500, other.status)
        assertFalse("secret" in other.message!!)
        assertFalse("pw" in other.message!!)
    }

    @Test
    fun `a 401 or 403 from the CDN a redirect took us to is a network error, not a gated repo`() {
        val cdn = reply(403).redirected()
        assertEquals(403, assertIs<NetException.Network>(errorFor(cdn, url, "m.gguf")).status)
    }

    @Test
    fun `a rate limit keeps the wait the server asked for, in seconds only`() {
        fun limited(value: String) = assertIs<NetException.RateLimited>(errorFor(reply(429, headers = mapOf("Retry-After" to value)), url, "repo"))
        assertEquals(120, limited(" 120 ").retryAfterSeconds)
        assertNull(limited("Wed, 21 Oct 2026 07:28:00 GMT").retryAfterSeconds)
        assertNull(limited("-5").retryAfterSeconds)
    }

    @Test
    fun `a rate limit waits for its used-up RateLimit policy before Retry-After`() {
        val both = mapOf("RateLimit" to "\"resolvers\";r=2999;t=10, \"api\";r=0;t=300", "Retry-After" to "60")
        assertEquals(300, assertIs<NetException.RateLimited>(errorFor(reply(429, headers = both), url, "repo")).retryAfterSeconds)
        val noneUsedUp = mapOf("RateLimit" to "\"api\";r=5;t=300", "Retry-After" to "60")
        assertEquals(60, assertIs<NetException.RateLimited>(errorFor(reply(429, headers = noneUsedUp), url, "repo")).retryAfterSeconds)
    }

    @Test
    fun `an engine's error that keeps ours as its cause is still ours`() {
        val ours = NetException.RateLimited("https://cdn/x", 5)
        assertEquals(ours, NetException.of(IllegalStateException("mapped", ours)))
        assertNull(NetException.of(IllegalStateException("bug")))
    }

    @Test
    fun `no response at all is a network error`() {
        val fake = FakePort()
        fake.on(url, { noResponse() })
        val e = assertThrows<NetException.Network> { fake.fetch(url, emptyMap()) }
        assertEquals(null, e.status)
        assertFalse("secret" in e.message!!)
    }

    @Test
    fun `bodies are read whole up to the cap`() {
        assertContentEquals("abc".toByteArray(), reply(200, "abc").readCapped(3, url, "page"))
        assertThrows<NetException.BadAnswer> { reply(200, "abcd").readCapped(3, url, "page") }
        assertThrows<NetException.Network> { brokenReply(200, "ab".toByteArray()).readCapped(10, url, "page") }
    }

    @Test
    fun `redacted urls keep scheme host and path only`() {
        assertEquals("https://huggingface.co/api/models", redactUrl(url))
        assertEquals("https://cdn.example/a/b", redactUrl("https://cdn.example/a/b#frag"))
        assertEquals("not a url", redactUrl("not a url"))
    }
}
