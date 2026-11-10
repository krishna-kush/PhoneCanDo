package com.phonecando.lme.api.model

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class ModelRecordTest {
    private val shape = ModelShape("llama", null, null, null, null, 16, null, KvCacheShape.NONE)

    @Test
    fun `the entry is the first file and the size sums every part`() {
        val files = listOf(ModelFile("m-00001-of-00002.gguf", 10, "a"), ModelFile("m-00002-of-00002.gguf", 5, "b"))
        val record = ModelRecord("m", "M", ModelSource.Imported("m.gguf"), files, shape, 0)
        assertEquals("m-00001-of-00002.gguf", record.entry.name)
        assertEquals(15, record.sizeBytes)
    }

    @Test
    fun `a record without files is a bug`() {
        assertThrows<IllegalArgumentException> { ModelRecord("m", "M", ModelSource.Imported("m.gguf"), emptyList(), shape, 0) }
    }

    @Test
    fun `a chosen context is at least one token, and none means automatic`() {
        val files = listOf(ModelFile("m.gguf", 10, "a"))
        assertEquals(null, ModelRecord("m", "M", ModelSource.Imported("m.gguf"), files, shape, 0).context)
        assertEquals(32_768, ModelRecord("m", "M", ModelSource.Imported("m.gguf"), files, shape, 0, context = 32_768).context)
        assertThrows<IllegalArgumentException> { ModelRecord("m", "M", ModelSource.Imported("m.gguf"), files, shape, 0, context = 0) }
    }
}
