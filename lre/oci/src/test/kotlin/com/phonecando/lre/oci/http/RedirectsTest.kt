package com.phonecando.lre.oci.http

import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.IOException
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RedirectsTest {
    private val auth = mapOf("Authorization" to "Bearer SECRET", "Range" to "bytes=10-", "Accept" to "*/*")

    @Test
    fun `a cross-host hop drops credentials and keeps Range`() {
        val fake = FakeTransport()
        fake.on("https://registry.test/v2/a/blobs/x", { reply(307, "", mapOf("Location" to "https://cdn.test/blob?sig=1")) })
        fake.on("https://cdn.test/blob?sig=1", { reply(206, "data") })

        val response = Redirects.get(fake, "https://registry.test/v2/a/blobs/x", auth)
        assertEquals(206, response.status)
        val cdn = fake.requests.last()
        assertNull(cdn.header("Authorization"))
        assertEquals("bytes=10-", cdn.header("Range"))
        assertEquals("*/*", cdn.header("Accept"))
    }

    @Test
    fun `same-origin and relative hops keep credentials, and once dropped they stay dropped`() {
        val fake = FakeTransport()
        fake.on("https://registry.test/a", { reply(302, "", mapOf("Location" to "/b")) })
        fake.on("https://registry.test/b", { reply(301, "", mapOf("Location" to "https://other.test/c")) })
        fake.on("https://other.test/c", { reply(307, "", mapOf("Location" to "https://registry.test/d")) })
        fake.on("https://registry.test/d", { reply(200, "ok") })

        Redirects.get(fake, "https://registry.test/a", auth).close()
        val sent = fake.requests.map { it.url to it.header("Authorization") }
        assertEquals(
            listOf(
                "https://registry.test/a" to "Bearer SECRET",
                "https://registry.test/b" to "Bearer SECRET",
                "https://other.test/c" to null,
                "https://registry.test/d" to null,
            ),
            sent,
        )
    }

    @Test
    fun `refuses downgrades, loops and missing locations`() {
        val fake = FakeTransport()
        fake.on("https://registry.test/down", { reply(302, "", mapOf("Location" to "http://registry.test/plain")) })
        fake.on("https://registry.test/loop", { reply(302, "", mapOf("Location" to "https://registry.test/loop")) })
        fake.on("https://registry.test/none", { reply(302, "") })
        fake.on("https://registry.test/ftp", { reply(302, "", mapOf("Location" to "ftp://registry.test/x")) })

        for (path in listOf("down", "loop", "none", "ftp")) {
            assertThrows<IOException>(path) { Redirects.get(fake, "https://registry.test/$path", auth) }
        }
        assertEquals(6, fake.requestsTo("https://registry.test/loop").size)
    }

    @Test
    fun `errors name urls without secrets`() {
        assertEquals("https://cdn.test/blob", redactUrl("https://cdn.test/blob?X-Amz-Signature=abc#frag"))
        assertEquals("https://host.test/p", redactUrl("https://user:pw@host.test/p"))
        assertEquals("https://host.test", redactUrl("https://user@host.test"))
        assertEquals("https://auth.docker.io/token", redactUrl("https://auth.docker.io/token?service=x&scope=y"))
    }
}
