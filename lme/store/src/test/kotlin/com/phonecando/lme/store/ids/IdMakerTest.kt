package com.phonecando.lme.store.ids

import com.phonecando.lme.api.model.ModelIds
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class IdMakerTest {
    @Test
    fun `ids from file names`() {
        assertEquals("qwen3-5-4b-q4-k-m", IdMaker.unique("Qwen3.5-4B-Q4_K_M.gguf", emptySet()))
        assertEquals("qwen3-5-122b-a10b-q4-k-m", IdMaker.unique("Q4_K_M/Qwen3.5-122B-A10B-Q4_K_M-00001-of-00003.gguf", emptySet()))
        assertEquals("model", IdMaker.unique("模型.gguf", emptySet()))
        assertEquals("model", IdMaker.unique(".gguf", emptySet()))
        assertEquals("a-b", IdMaker.unique("C:\\dl\\A  B.GGUF", emptySet()))
    }

    @Test
    fun `the next free id`() {
        assertEquals("m-2", IdMaker.unique("m.gguf", setOf("m")))
        assertEquals("m-4", IdMaker.unique("m.gguf", setOf("m", "m-2", "m-3")))
        val long = "x".repeat(200) + ".gguf"
        val first = IdMaker.unique(long, emptySet())
        assertEquals(ModelIds.MAX_LENGTH, first.length)
        val second = IdMaker.unique(long, setOf(first))
        assertTrue(ModelIds.isValid(second) && second.endsWith("-2") && second.length <= ModelIds.MAX_LENGTH, second)
    }

    @Test
    fun `stems drop the folder, the extension and the part`() {
        assertEquals("Qwen3.5-4B-Q4_K_M", IdMaker.stem("Qwen3.5-4B-Q4_K_M.gguf"))
        assertEquals("big", IdMaker.stem("dir/big-00002-of-00003.gguf"))
        assertEquals("notes.txt", IdMaker.stem("notes.txt"))
    }
}
