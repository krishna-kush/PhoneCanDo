package com.phonecando.lre.tar.path

import com.phonecando.lre.api.LreException
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class EntryPathTest {
    @Test
    fun normalises() {
        assertEquals(listOf("a", "b", "c"), EntryPath.parse("./a//b/./c/"))
        assertEquals(listOf("b"), EntryPath.parse("a/../b"))
        assertEquals(emptyList(), EntryPath.parse("./"))
        assertEquals(emptyList(), EntryPath.parse("a/.."))
        assertEquals(listOf("..."), EntryPath.parse("..."))
    }

    @Test
    fun `rejects escapes, absolute names and NUL`() {
        for (bad in listOf("/etc/passwd", "..", "../x", "a/../../x", "./../x", "a/b/../../..", "a\u0000b")) {
            assertFailsWith<LreException.UnsafeEntry>(bad) { EntryPath.parse(bad) }
        }
    }
}
