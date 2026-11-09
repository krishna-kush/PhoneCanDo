package com.phonecando.lre.image.setup

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.ImageSetup
import com.phonecando.lre.image.reset.GuestResult
import com.phonecando.lre.image.reset.ImageReset
import com.phonecando.lre.image.support.BytesLayer
import com.phonecando.lre.image.support.ConfParser
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.TinyTar
import com.phonecando.lre.image.support.config
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** End to end through the real tar extractor (the default [TarUnpacker]). */
class TarSetupTest {
    @TempDir
    lateinit var dir: File

    private fun debianLayers(): List<BytesLayer> {
        val base = TinyTar()
            .link("bin", "usr/bin").link("sbin", "usr/sbin")
            .dir("usr").dir("usr/bin").dir("usr/sbin").dir("usr/lib").dir("etc").dir("etc/apt").dir("etc/apt/apt.conf.d")
            .exe("usr/bin/bash").exe("usr/bin/dash").link("usr/bin/sh", "dash").exe("usr/bin/apt-get")
            .file("usr/lib/os-release", "ID=debian\nVERSION_ID=\"13\"\nPRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\n")
            .link("etc/os-release", "../usr/lib/os-release")
            .link("etc/resolv.conf", "/run/systemd/resolve/stub-resolv.conf")
        // A second layer adds git on top.
        val top = TinyTar().dir("usr/share/man").exe("usr/bin/git")
        return listOf(BytesLayer(base.gzip()), BytesLayer(top.gzip()))
    }

    @Test
    fun `a two-layer gzip base becomes a ready image`() {
        val layout = ImageLayout(File(dir, "files/images/d1"))
        val host = Hosts.local(dir)
        val base = BaseImage(debianLayers(), config("PATH=/usr/local/bin:/usr/bin:/bin", "LANG=C.UTF-8"))

        val result = ImageSetup().create(layout, base, host, Long.MAX_VALUE)

        assertEquals("debian", result.os?.id)
        assertEquals(PackageFamily.APT, result.os?.family)
        assertEquals(listOf("rg"), ImageSetup.checkTools(layout, listOf("bash", "git", "rg")).commands)
        assertTrue(File(layout.shims, "git").let { Files.isSymbolicLink(it.toPath()) })
        assertFalse(Files.isSymbolicLink(File(layout.rootfs, "etc/resolv.conf").toPath()))
        val conf = ConfParser.parse(layout.launchConf.readText())
        assertTrue("PATH=/usr/local/bin:/usr/bin:/bin" in conf.sets)
        assertEquals(1, conf.sets.count { it.startsWith("LANG=") })

        // The old system marks a hand-installed package; the fresh base marks none.
        val answers = ArrayDeque(listOf("git\n", ""))
        val reset = ImageReset({ _, _ -> GuestResult(0, answers.removeFirst()) })
            .reset(layout, BaseImage(debianLayers(), base.config), host, Long.MAX_VALUE)
        assertEquals(listOf("git"), reset.reinstall?.packages)
        assertTrue(File(layout.rootfs, "usr/bin/git").isFile)
    }
}
