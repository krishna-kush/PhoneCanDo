package com.phonecando.lme.host.key

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ApiKeysTest {
    @Test
    fun `fresh hex keys`() {
        val a = ApiKeys.newKey()
        assertTrue(ApiKeys.isValid(a), a)
        assertNotEquals(a, ApiKeys.newKey())
        assertFalse(ApiKeys.isValid("a,b"))
        assertFalse(ApiKeys.isValid(a.uppercase()))
    }
}
