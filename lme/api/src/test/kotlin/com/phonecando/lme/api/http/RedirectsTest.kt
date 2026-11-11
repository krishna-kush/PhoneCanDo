package com.phonecando.lme.api.http

import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RedirectsTest {
    private val fake = FakePort()
    private val start = "https://huggingface.co/acme/m-GGUF/resolve/abc/m.gguf"

    @Test
    fun `a token stays on its own origin and Range follows the hops`() {
        fake.on(start, { reply(302, headers = mapOf("Location" to "/api/resolve-cache/m.gguf")) })
        fake.on(
            "https://huggingface.co/api/resolve-cache/m.gguf",
            { reply(302, headers = mapOf("Location" to "https://cdn.example/blob?X-Sig=secret")) },
        )
        fake.on("https://cdn.example/blob?X-Sig=secret", { reply(206, "ok") })

        val response = Redirects.get(fake, start, mapOf("Authorization" to "Bearer hf_x", "Range" to "bytes=5-"))

        assertEquals(206, response.status)
        assertTrue(response.redirectedAway)
        assertEquals("Bearer hf_x", fake.requests[1].header("authorization"))
        assertNull(fake.requests[2].header("authorization"))
        assertEquals("bytes=5-", fake.requests[2].header("range"))
    }

    @Test
    fun `credentials dropped once stay dropped on the way back`() {
        fake.on(start, { reply(302, headers = mapOf("Location" to "https://cdn.example/a")) })
        fake.on("https://cdn.example/a", { reply(302, headers = mapOf("Location" to "https://huggingface.co/b")) })
        fake.on("https://huggingface.co/b", { reply(200, "ok") })

        val response = Redirects.get(fake, start, mapOf("Authorization" to "Bearer hf_x", "X-Api-Key" to "k"))

        assertNull(fake.requests[2].header("authorization"))
        assertNull(fake.requests[2].header("x-api-key"))
        // Back on the origin asked: the answer is the Hub's own.
        assertFalse(response.redirectedAway)
    }

    @Test
    fun `an answer from the origin asked is not marked`() {
        fake.on(start, { reply(302, headers = mapOf("Location" to "/api/resolve-cache/m.gguf")) })
        fake.on("https://huggingface.co/api/resolve-cache/m.gguf", { reply(403) })
        assertFalse(Redirects.get(fake, start, emptyMap()).redirectedAway)
    }

    @Test
    fun `a downgrade to http is refused`() {
        fake.on(start, { reply(301, headers = mapOf("Location" to "http://cdn.example/a")) })
        assertThrows<IOException> { Redirects.get(fake, start, emptyMap()) }
    }

    @Test
    fun `a redirect loop ends after five hops`() {
        fake.on(start, { reply(302, headers = mapOf("Location" to start)) })
        assertThrows<IOException> { Redirects.get(fake, start, emptyMap()) }
        assertEquals(6, fake.requests.size)
    }

    @Test
    fun `a redirect without a location or to another scheme fails`() {
        fake.on(start, { reply(302) })
        assertThrows<IOException> { Redirects.get(fake, start, emptyMap()) }
        fake.on(start, { reply(302, headers = mapOf("Location" to "file:///etc/passwd")) })
        assertThrows<IOException> { Redirects.get(fake, start, emptyMap()) }
    }
}
