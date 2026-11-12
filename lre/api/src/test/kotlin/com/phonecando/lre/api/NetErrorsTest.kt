package com.phonecando.lre.api

import com.phonecando.network.NetException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertSame

class NetErrorsTest {
    @Test
    fun `each network failure becomes lre's own, keeping it as the cause`() {
        val cases: List<Pair<NetException, (LreException) -> Unit>> = listOf(
            NetException.Network("https://r/v2/x", 503) to { e -> assertEquals(503, assertIs<LreException.Network>(e).status) },
            NetException.RateLimited("https://r/v2/x", 30) to { e -> assertEquals(30L, assertIs<LreException.RateLimited>(e).retryAfterSeconds) },
            NetException.NotFound("layer x") to { e -> assertEquals("layer x", assertIs<LreException.NotFound>(e).what) },
            // A registry's 403 was always a network error: the next mirror may serve.
            NetException.AccessDenied("layer x", "https://r/v2/x", 403) to { e -> assertEquals(403, assertIs<LreException.Network>(e).status) },
            NetException.BadAnswer("tags") to { e -> assertIs<LreException.Corrupt>(e) },
            NetException.SizeMismatch("blob x", 10, 11) to { e -> assertEquals(10L, assertIs<LreException.TooLarge>(e).limit) },
            NetException.DigestMismatch("blob x", "aa", "bb") to { e ->
                val m = assertIs<LreException.DigestMismatch>(e)
                assertEquals("sha256:aa" to "sha256:bb", m.expected to m.actual)
            },
            NetException.Cancelled() to { e -> assertIs<LreException.Cancelled>(e) },
        )
        for ((net, check) in cases) {
            val lre = net.toLre()
            check(lre)
            assertSame(net, lre.cause)
        }
    }

    @Test
    fun `an answer past a named cap is too large`() {
        val e = assertThrows<LreException.TooLarge> {
            lreNet("manifest", 4096) { throw NetException.BadAnswer("manifest: over 4096 bytes") }
        }
        assertEquals("manifest exceeds 4096 bytes", e.message)
    }

    @Test
    fun `lre's own errors pass through`() {
        val own = LreException.NoShell()
        assertSame(own, assertThrows<LreException.NoShell> { lreNet { throw own } })
    }
}
