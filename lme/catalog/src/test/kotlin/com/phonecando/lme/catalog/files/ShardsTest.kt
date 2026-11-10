package com.phonecando.lme.catalog.files

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ShardsTest {
    @Test
    fun `split part names`() {
        assertEquals(Shards.Part("m-Q4_K_M", 2, 3), Shards.part("m-Q4_K_M-00002-of-00003.gguf"))
        assertEquals("m-Q4_K_M.gguf", Shards.stem("m-Q4_K_M-00001-of-00003.gguf"))
        assertNull(Shards.part("m-Q4_K_M.gguf"))
        assertNull(Shards.part("m-00004-of-00003.gguf"))
        assertNull(Shards.part("m-00000-of-00003.gguf"))
        assertNull(Shards.part("m-0001-of-0003.gguf"))
        assertEquals("plain.gguf", Shards.stem("plain.gguf"))
    }
}
