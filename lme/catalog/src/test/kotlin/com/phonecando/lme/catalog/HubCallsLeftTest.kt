package com.phonecando.lme.catalog

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HubCallsLeftTest {
    private var now = 1_000_000L
    private val left = HubCallsLeft { now }

    @Test
    fun `with nothing known every request may go`() {
        assertTrue(left.atLeast(Int.MAX_VALUE))
        left.note(null)
        left.note("\"resolvers\";r=0;t=60")
        assertTrue(left.atLeast(Int.MAX_VALUE))
    }

    @Test
    fun `the last answer says how many are left until its window ends`() {
        left.note("\"api\";r=120;t=60")
        assertTrue(left.atLeast(100))
        left.note("\"api\";r=99;t=59")
        assertFalse(left.atLeast(100))
        assertTrue(left.atLeast(99))
        now += 58_999
        assertFalse(left.atLeast(100))
        now += 1
        assertTrue(left.atLeast(100))
    }
}
