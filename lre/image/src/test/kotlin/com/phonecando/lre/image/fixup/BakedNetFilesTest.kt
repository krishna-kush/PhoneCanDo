package com.phonecando.lre.image.fixup

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

// The Default image bakes its own hosts and hostname
// (lre/images/default/recipe/files/etc/) in the format setup writes; setup
// then writes the OS's name (debian) over them.
class BakedNetFilesTest {
    // Gradle runs a module's tests in its own dir, lre/image.
    private val etc = File("../images/default/recipe/files/etc")

    @Test
    fun `the Default image bakes a hostname and hosts in setup's format`() {
        val hostname = File(etc, "hostname").readText()
        val name = assertNotNull(Hostname.parse(hostname))
        assertEquals(NetFiles.hostname(name), hostname)
        assertEquals(NetFiles.hosts(name), File(etc, "hosts").readText())
    }
}
