package com.phonecando.lme.catalog.hub

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RateLimitHeaderTest {
    @Test
    fun `the API policy's calls and seconds left`() {
        assertEquals(RateLimitHeader.Left(495, 32), RateLimitHeader.api("\"api\";r=495;t=32"))
        assertEquals(RateLimitHeader.Left(0, 300), RateLimitHeader.api("\"api\"; r=0; t=300"))
    }

    @Test
    fun `the API policy is found among others`() {
        assertEquals(RateLimitHeader.Left(7, 5), RateLimitHeader.api("\"resolvers\";r=2999;t=10, \"api\";r=7;t=5"))
    }

    @Test
    fun `no header, another policy only, or numbers we cannot read say nothing`() {
        assertNull(RateLimitHeader.api(null))
        assertNull(RateLimitHeader.api(""))
        assertNull(RateLimitHeader.api("\"resolvers\";r=2999;t=10"))
        assertNull(RateLimitHeader.api("api;r=5;t=5"))
        assertNull(RateLimitHeader.api("\"api\";r=-1;t=5"))
        assertNull(RateLimitHeader.api("\"api\";r=many;t=5"))
        assertNull(RateLimitHeader.api("\"api\";r=5"))
    }
}
