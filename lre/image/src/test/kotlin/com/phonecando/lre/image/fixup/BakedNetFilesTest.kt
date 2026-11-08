package com.phonecando.lre.image.fixup

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals

// The Default image bakes its own hosts and hostname
// (lre/images/default/recipe/files/etc/). They say what setup writes over
// them, so the published image agrees with a running one.
class BakedNetFilesTest {
    // Gradle runs a module's tests in its own dir, lre/image.
    private val etc = File("../images/default/recipe/files/etc")

    @Test
    fun `the Default image bakes setup's hostname and hosts`() {
        assertEquals(NetFiles.hostname(), File(etc, "hostname").readText())
        assertEquals(NetFiles.hosts(), File(etc, "hosts").readText())
    }
}
