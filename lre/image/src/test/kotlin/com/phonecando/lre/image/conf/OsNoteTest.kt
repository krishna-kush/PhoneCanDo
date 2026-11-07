package com.phonecando.lre.image.conf

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import kotlin.test.Test
import kotlin.test.assertEquals

class OsNoteTest {
    @Test
    fun `names the OS, the package manager and its install line`() {
        val os = OsInfo("alpine", "3.22.2", emptyList(), "Alpine Linux v3.22", PackageFamily.APK, "/bin/sh")
        assertEquals(
            "This machine: Alpine Linux v3.22 (apk). Install packages with `apk add <pkg>`. " +
                "No systemd: start services by hand. Commands run as root, so no sudo is needed.\n",
            OsNote.text(os),
        )
    }

    @Test
    fun `apt carries its update step`() {
        val os = OsInfo("debian", "12", emptyList(), "Debian GNU/Linux 12 (bookworm)", PackageFamily.APT, "/bin/bash")
        assertEquals(
            "This machine: Debian GNU/Linux 12 (bookworm) (apt). " +
                "Install packages with `apt-get update && apt-get install -y <pkg>`. " +
                "No systemd: start services by hand. Commands run as root, so no sudo is needed.\n",
            OsNote.text(os),
        )
    }

    @Test
    fun `unknown family and no pretty name`() {
        val os = OsInfo("linux", null, emptyList(), null, null, "/bin/sh")
        assertEquals(
            "This machine: linux. No systemd: start services by hand. Commands run as root, so no sudo is needed.\n",
            OsNote.text(os),
        )
    }
}
