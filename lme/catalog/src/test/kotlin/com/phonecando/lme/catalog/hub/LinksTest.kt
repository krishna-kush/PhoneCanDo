package com.phonecando.lme.catalog.hub

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class LinksTest {
    @Test
    fun `the next link among others`() {
        val next = "https://huggingface.co/api/models?cursor=abc"
        assertEquals(next, Links.next("<$next>; rel=\"next\""))
        assertEquals(next, Links.next("<https://huggingface.co/x>; rel=\"prev\", <$next>; rel=next"))
        assertNull(Links.next("<https://huggingface.co/x>; rel=\"xet-auth\""))
        assertNull(Links.next(null))
    }

    @Test
    fun `a next link off the Hub is ignored`() {
        assertNull(Links.next("<https://evil.example/api/models>; rel=\"next\""))
        assertNull(Links.next("<http://huggingface.co/api/models>; rel=\"next\""))
    }
}
