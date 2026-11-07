package com.phonecando.lre.image.detect

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.support.Distros
import com.phonecando.lre.image.support.Tree
import com.phonecando.lre.image.support.config
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DetectorTest {
    @TempDir
    lateinit var dir: File

    private val rootfs get() = File(dir, "rootfs")

    @Test
    fun `debian with merged usr and os-release behind a symlink`() {
        Distros.debian(rootfs)
        val d = Detector().detect(rootfs, null)
        assertEquals("debian", d.os.id)
        assertEquals("12", d.os.versionId)
        assertEquals("Debian GNU/Linux 12 (bookworm)", d.os.prettyName)
        assertEquals(PackageFamily.APT, d.os.family)
        assertEquals("/bin/bash", d.os.shell)
        assertTrue(d.hasBash)
        assertTrue(d.hasSh)
        assertNull(d.busyboxSh)
    }

    @Test
    fun `alpine with busybox and apk`() {
        Distros.alpine(rootfs)
        val d = Detector().detect(rootfs, null)
        assertEquals("alpine", d.os.id)
        assertEquals(PackageFamily.APK, d.os.family)
        assertEquals("/bin/sh", d.os.shell)
        assertFalse(d.hasBash)
        assertTrue(d.hasSh)
    }

    @Test
    fun `fedora minimal has only microdnf`() {
        Distros.fedoraMinimal(rootfs)
        val d = Detector().detect(rootfs, null)
        assertEquals("fedora", d.os.id)
        assertEquals(PackageFamily.MICRODNF, d.os.family)
    }

    @Test
    fun `arch uses pacman`() {
        Distros.arch(rootfs)
        assertEquals(PackageFamily.PACMAN, Detector().detect(rootfs, null).os.family)
    }

    @Test
    fun `opensuse uses zypper and reports ID_LIKE`() {
        Distros.opensuse(rootfs)
        val d = Detector().detect(rootfs, null)
        assertEquals(PackageFamily.ZYPPER, d.os.family)
        assertEquals(listOf("opensuse", "suse"), d.os.idLike)
        assertEquals("opensuse-tumbleweed", d.os.id)
    }

    @Test
    fun `no package manager and no os-release still works`() {
        Distros.bare(rootfs)
        val d = Detector().detect(rootfs, null)
        assertNull(d.os.family)
        assertEquals("linux", d.os.id)
        assertNull(d.os.prettyName)
        assertEquals("/bin/sh", d.os.shell)
    }

    @Test
    fun `no shell is a typed error`() {
        Distros.noShell(rootfs)
        assertFailsWith<LreException.NoShell> { Detector().detect(rootfs, null) }
    }

    @Test
    fun `os-release only under usr lib`() {
        Tree(rootfs).exe("bin/sh").file("usr/lib/os-release", "ID=void\nPRETTY_NAME=\"Void Linux\"\n")
            .exe("usr/bin/xbps-install")
        val d = Detector().detect(rootfs, null)
        assertEquals("void", d.os.id)
        assertEquals(PackageFamily.XBPS, d.os.family)
    }

    @Test
    fun `busybox alone gets a planned sh link`() {
        Tree(rootfs).exe("bin/busybox")
        val d = Detector().detect(rootfs, null)
        assertEquals("/bin/sh", d.os.shell)
        assertEquals("/bin/busybox", d.busyboxSh)
        assertTrue(d.hasSh)
    }

    @Test
    fun `ash alone is the shell and stands in for sh`() {
        Tree(rootfs).exe("bin/ash")
        val d = Detector().detect(rootfs, null)
        assertEquals("/bin/ash", d.os.shell)
        assertFalse(d.hasSh)
        assertFalse(d.hasBash)
    }

    @Test
    fun `binaries count only on the image PATH`() {
        Tree(rootfs).exe("bin/sh").exe("opt/tools/bin/apk")
        assertNull(Detector().detect(rootfs, null).os.family)
        assertEquals(PackageFamily.APK, Detector().detect(rootfs, config("PATH=/opt/tools/bin:/bin")).os.family)
    }

    @Test
    fun `a resolv conf link pointing outside does not confuse detection`() {
        Distros.debian(rootfs)
        Tree(rootfs).link("usr/bin/broken", "/nowhere/at/all")
        assertEquals(PackageFamily.APT, Detector().detect(rootfs, null).os.family)
    }
}
