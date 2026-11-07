package com.phonecando.lre.image.conf

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.support.Hosts
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PathSpellingsTest {
    private val spellings = Hosts.phone.dataDirSpellings

    @Test
    fun `a path under any spelling comes back under all, canonical first`() {
        val expected = listOf("/data/user/0/com.phonecando.app/files/x", "/data/data/com.phonecando.app/files/x")
        assertEquals(expected, PathSpellings.of("/data/user/0/com.phonecando.app/files/x", spellings))
        assertEquals(expected, PathSpellings.of("/data/data/com.phonecando.app/files/x", spellings))
    }

    @Test
    fun `a path under none stays alone, and prefixes match whole components`() {
        assertEquals(listOf("/tmp/x"), PathSpellings.of("/tmp/x", spellings))
        assertEquals(
            listOf("/data/data/com.phonecando.appx/files"),
            PathSpellings.of("/data/data/com.phonecando.appx/files", spellings),
        )
    }

    @Test
    fun `socket budget flags long home paths under any spelling`() {
        assertFalse(SocketBudget.isTight(Hosts.phoneLayout, Hosts.phone))
        val long = ImageLayout(File("/data/user/0/com.phonecando.app/files/images/" + "x".repeat(20)))
        // ".../images/" is 45 bytes, + 20 + "/home" = 70; + 40 = 110 > 108.
        assertTrue(SocketBudget.isTight(long, Hosts.phone))
    }
}
