package com.phonecando.lme.api.http

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.brokenReply
import com.phonecando.lme.api.testkit.noResponse
import com.phonecando.lme.api.testkit.reply
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
        assertIs<LmeException.AccessDenied>(errorFor(reply(401), url, "repo"))
        assertIs<LmeException.AccessDenied>(errorFor(reply(403), url, "repo"))
        assertIs<LmeException.NotFound>(errorFor(reply(404), url, "repo"))
        assertIs<LmeException.NotFound>(errorFor(reply(410), url, "repo"))
        val limited = assertIs<LmeException.RateLimited>(errorFor(reply(429), url, "repo"))
        assertEquals("https://huggingface.co/api/models", limited.url)
        assertNull(limited.retryAfterSeconds)
        val other = assertIs<LmeException.Network>(errorFor(reply(500), url, "repo"))
        assertEquals(500, other.status)
        assertFalse("secret" in other.message!!)
        assertFalse("pw" in other.message!!)
    }

    @Test
    fun `a 401 or 403 from the CDN a redirect took us to is a network error, not a gated repo`() {
        val cdn = reply(403).redirected()
        assertEquals(403, assertIs<LmeException.Network>(errorFor(cdn, url, "m.gguf")).status)
    }

    @Test
    fun `a rate limit keeps the wait the server asked for, in seconds only`() {
        fun limited(value: String) = assertIs<LmeException.RateLimited>(errorFor(reply(429, headers = mapOf("Retry-After" to value)), url, "repo"))
        assertEquals(120, limited(" 120 ").retryAfterSeconds)
        assertNull(limited("Wed, 21 Oct 2026 07:28:00 GMT").retryAfterSeconds)
        assertNull(limited("-5").retryAfterSeconds)
    }

    @Test
    fun `no response at all is a network error`() {
        val fake = FakePort()
        fake.on(url, { noResponse() })
        val e = assertThrows<LmeException.Network> { fake.fetch(url, emptyMap()) }
        assertEquals(null, e.status)
        assertFalse("secret" in e.message!!)
    }

    @Test
    fun `bodies are read whole up to the cap`() {
        assertContentEquals("abc".toByteArray(), reply(200, "abc").readCapped(3, url, "page"))
        assertThrows<LmeException.BadAnswer> { reply(200, "abcd").readCapped(3, url, "page") }
        assertThrows<LmeException.Network> { brokenReply(200, "ab".toByteArray()).readCapped(10, url, "page") }
    }

    @Test
    fun `redacted urls keep scheme host and path only`() {
        assertEquals("https://huggingface.co/api/models", redactUrl(url))
        assertEquals("https://cdn.example/a/b", redactUrl("https://cdn.example/a/b#frag"))
        assertEquals("not a url", redactUrl("not a url"))
    }
}
