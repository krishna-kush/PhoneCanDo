package com.phonecando.lme.api.serve

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ServedEndpointTest {
    @Test
    fun `toString never shows the key`() {
        val endpoint = ServedEndpoint("http://127.0.0.1:8099", "m", "s3cr3t-key", 16384, setOf(WireApi.OPENAI_CHAT))
        val text = endpoint.toString()
        assertFalse("s3cr3t-key" in text)
        assertTrue("key=<hidden>" in text)
    }
}
