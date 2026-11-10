package com.phonecando.lme.catalog.hub

import com.phonecando.lme.api.LmeException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HubNamesTest {
    @Test
    fun `repository names`() {
        assertEquals("unsloth/Qwen3.5-4B-GGUF", HubNames.repo(" unsloth/Qwen3.5-4B-GGUF "))
        for (bad in listOf("", "a", "a/b/c", "a//b", "-a/b", "a/b.", "a/b--c", "a/b..c", "a/b c", "a/" + "x".repeat(97))) {
            assertThrows<LmeException.InvalidName>(bad) { HubNames.repo(bad) }
        }
    }

    @Test
    fun `shas are full and lower-case`() {
        assertTrue(HubNames.isSha("e87f176479d0855a907a41277aca2f8ee7a09523"))
        assertFalse(HubNames.isSha("main"))
        assertFalse(HubNames.isSha("E87F176479D0855A907A41277ACA2F8EE7A09523"))
        assertThrows<LmeException.InvalidName> { HubNames.sha("e87f176") }
    }

    @Test
    fun `plain paths only`() {
        for (ok in listOf("a.gguf", "Q4_K_M/a-00001-of-00002.gguf", "MTP/README.md")) assertTrue(HubNames.isPlainPath(ok), ok)
        for (bad in listOf("", "/a", "a/", "../a", "a/../b", "./a", "a\\b", "a\nb", "a//b")) assertFalse(HubNames.isPlainPath(bad), bad)
    }

    @Test
    fun `download urls encode each path segment`() {
        assertEquals(
            "https://huggingface.co/a/b/resolve/${"0".repeat(40)}/dir%20x/m%2B1.gguf",
            HubUrls.resolve("a/b", "0".repeat(40), "dir x/m+1.gguf"),
        )
    }
}
