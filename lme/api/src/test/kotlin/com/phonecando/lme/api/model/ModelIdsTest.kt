package com.phonecando.lme.api.model

import com.phonecando.lme.api.LmeException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ModelIdsTest {
    @Test
    fun `ids are dashed lower-case words`() {
        for (id in listOf("qwen3-5-4b-q4-k-m", "a", "m2", "gemma-4-e2b-it-q4-k-m-2")) assertTrue(ModelIds.isValid(id), id)
        for (id in listOf("", "-a", "a-", "a--b", "Qwen", "a.b", "a/b", "a b", "models.json", "x".repeat(81))) {
            assertFalse(ModelIds.isValid(id), id)
        }
    }

    @Test
    fun `check names the rule`() {
        assertEquals("ok-1", ModelIds.check("ok-1"))
        val e = assertThrows<LmeException.InvalidName> { ModelIds.check("../x") }
        assertEquals("../x", e.input)
    }
}
