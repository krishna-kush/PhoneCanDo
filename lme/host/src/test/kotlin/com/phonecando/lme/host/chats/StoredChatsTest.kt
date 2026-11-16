package com.phonecando.lme.host.chats

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StoredChatsTest {
    private val gib = 1L shl 30

    @Test
    fun `chats go to storage while one more leaves the margin free, up to four`() {
        // The 0.8B's 15k-token chat took 159 MB.
        assertEquals(StoredChats.MOST, StoredChats.kept(8 * gib, 159_000_000))
        assertEquals(4, StoredChats.MOST)
        assertEquals(0, StoredChats.kept(gib + 158_000_000, 159_000_000))
        assertEquals(StoredChats.MOST, StoredChats.kept(gib + 159_000_000, 159_000_000))
        // No storage for them (or saving failed): none.
        assertEquals(0, StoredChats.kept(null, 1))
        assertTrue(StoredChats.fits(2 * gib, gib))
        assertFalse(StoredChats.fits(2 * gib, gib + 1))
    }

    @Test
    fun `the dir is absolute`() {
        assertThrows<IllegalArgumentException> { ChatStorage("models/x/.chats", 1) }
        assertEquals("/data/x", ChatStorage("/data/x", 0).dir)
    }
}
