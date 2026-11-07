package com.phonecando.lre.oci.auth

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class TokenCacheTest {
    @Test
    fun `keeps a token per key until shortly before expiry`() {
        var now = 0L
        val cache = TokenCache { now }
        cache.put("hub/library/alpine", "t1", ttlSeconds = 300)
        assertEquals("t1", cache.get("hub/library/alpine"))
        assertNull(cache.get("hub/library/debian"))

        now = 269_000 // 300 s minus the 30 s margin, less 1 s
        assertEquals("t1", cache.get("hub/library/alpine"))
        now = 270_000
        assertNull(cache.get("hub/library/alpine"))
    }

    @Test
    fun `short lifetimes keep a proportional margin and drop works`() {
        var now = 0L
        val cache = TokenCache { now }
        cache.put("k", "t", ttlSeconds = 60) // margin 15 s
        now = 44_999
        assertEquals("t", cache.get("k"))
        cache.drop("k")
        assertNull(cache.get("k"))
    }

    @Test
    fun `a token never prints`() {
        assertFalse(Token("SECRET", 60).toString().contains("SECRET"))
    }
}
