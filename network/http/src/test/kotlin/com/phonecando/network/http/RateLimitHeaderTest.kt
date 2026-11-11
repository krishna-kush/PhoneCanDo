package com.phonecando.network.http

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RateLimitHeaderTest {
    @Test
    fun `a policy's calls and seconds left`() {
        assertEquals(RateLimitHeader.Left(495, 32), RateLimitHeader.policy("\"api\";r=495;t=32", "api"))
        assertEquals(RateLimitHeader.Left(0, 300), RateLimitHeader.policy("\"api\"; r=0; t=300", "api"))
    }

    @Test
    fun `a policy is found among others`() {
        assertEquals(RateLimitHeader.Left(7, 5), RateLimitHeader.policy("\"resolvers\";r=2999;t=10, \"api\";r=7;t=5", "api"))
    }

    @Test
    fun `no header, another policy only, or numbers we cannot read say nothing`() {
        assertNull(RateLimitHeader.policy(null, "api"))
        assertNull(RateLimitHeader.policy("", "api"))
        assertNull(RateLimitHeader.policy("\"resolvers\";r=2999;t=10", "api"))
        assertNull(RateLimitHeader.policy("api;r=5;t=5", "api"))
        assertNull(RateLimitHeader.policy("\"api\";r=-1;t=5", "api"))
        assertNull(RateLimitHeader.policy("\"api\";r=many;t=5", "api"))
        assertNull(RateLimitHeader.policy("\"api\";r=5", "api"))
    }

    @Test
    fun `the used-up policy says how long to wait`() {
        assertEquals(300, RateLimitHeader.exhausted("\"resolvers\";r=2999;t=10, \"api\";r=0;t=300"))
        assertNull(RateLimitHeader.exhausted("\"api\";r=1;t=300"))
        assertNull(RateLimitHeader.exhausted(null))
    }
}
