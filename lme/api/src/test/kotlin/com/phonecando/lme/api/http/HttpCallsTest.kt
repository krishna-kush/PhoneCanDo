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

class HttpCallsTest {
    private val url = "https://user:pw@huggingface.co/api/models?search=x&token=secret"

    @Test
    fun `status codes map to typed errors without secrets`() {
        assertIs<LmeException.AccessDenied>(errorFor(401, url, "repo"))
        assertIs<LmeException.AccessDenied>(errorFor(403, url, "repo"))
        assertIs<LmeException.NotFound>(errorFor(404, url, "repo"))
        val limited = assertIs<LmeException.RateLimited>(errorFor(429, url, "repo"))
        assertEquals("https://huggingface.co/api/models", limited.url)
        val other = assertIs<LmeException.Network>(errorFor(500, url, "repo"))
        assertEquals(500, other.status)
        assertFalse("secret" in other.message!!)
        assertFalse("pw" in other.message!!)
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
        assertThrows<LmeException.TooLarge> { reply(200, "abcd").readCapped(3, url, "page") }
        assertThrows<LmeException.Network> { brokenReply(200, "ab".toByteArray()).readCapped(10, url, "page") }
    }

    @Test
    fun `redacted urls keep scheme host and path only`() {
        assertEquals("https://huggingface.co/api/models", redactUrl(url))
        assertEquals("https://cdn.example/a/b", redactUrl("https://cdn.example/a/b#frag"))
        assertEquals("not a url", redactUrl("not a url"))
    }
}
