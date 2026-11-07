package com.phonecando.lre.image.detect

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class OsReleaseTest {
    @Test
    fun `parses bare, double- and single-quoted values with escapes`() {
        val parsed = OsRelease.parse(
            """
            # comment
            ID=ubuntu
            PRETTY_NAME="Ubuntu 24.04.3 LTS"
            NAME='Ubuntu Linux'
            QUOTED="say \"hi\" \\ there"
            ID_LIKE="debian"

            not a line
            =nokey
            """.trimIndent(),
        )
        assertEquals("ubuntu", parsed["ID"])
        assertEquals("Ubuntu 24.04.3 LTS", parsed["PRETTY_NAME"])
        assertEquals("Ubuntu Linux", parsed["NAME"])
        assertEquals("say \"hi\" \\ there", parsed["QUOTED"])
        assertEquals("debian", parsed["ID_LIKE"])
        assertFalse(parsed.containsKey(""))
    }
}
