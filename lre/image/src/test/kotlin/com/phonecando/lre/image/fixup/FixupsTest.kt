package com.phonecando.lre.image.fixup

import com.phonecando.lre.image.detect.Detector
import com.phonecando.lre.image.family.ProotFixText
import com.phonecando.lre.image.support.Distros
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.Tree
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FixupsTest {
    @TempDir
    lateinit var dir: File

    private val rootfs get() = File(dir, "rootfs")

    @Test
    fun `resolv conf symlink is replaced by a file, its target untouched`() {
        val hostStub = File(dir, "run/systemd/resolve/stub-resolv.conf").apply {
            parentFile.mkdirs()
            writeText("nameserver 127.0.0.53\n")
        }
        Distros.debian(rootfs)
        // An absolute link that would hit our host file if we followed it host-side.
        Files.delete(File(rootfs, "etc/resolv.conf").toPath())
        Tree(rootfs).link("etc/resolv.conf", hostStub.path)
        val detection = Detector().detect(rootfs, null)

        Fixups().apply(rootfs, detection, Hosts.local(dir, dns = listOf("10.0.0.1", "fe80::1%wlan0", "bogus;rm")))

        val resolv = File(rootfs, "etc/resolv.conf").toPath()
        assertFalse(Files.isSymbolicLink(resolv))
        assertEquals("nameserver 10.0.0.1\nnameserver fe80::1%wlan0\n", Files.readString(resolv))
        assertEquals("nameserver 127.0.0.53\n", hostStub.readText())
    }

    @Test
    fun `debian gets hosts, hostname and the apt sandbox fix, idempotently`() {
        Distros.debian(rootfs)
        val detection = Detector().detect(rootfs, null)
        val host = Hosts.local(dir)
        Fixups().apply(rootfs, detection, host)
        val first = snapshot()
        Fixups().apply(rootfs, detection, host)
        assertEquals(first, snapshot())

        assertEquals(NetFiles.FALLBACK_DNS.joinToString("") { "nameserver $it\n" }, first["etc/resolv.conf"])
        assertTrue(first.getValue("etc/hosts").startsWith("127.0.0.1 localhost phonecando\n"))
        assertEquals("phonecando\n", first["etc/hostname"])
        assertEquals(ProotFixText.APT_CONF, first["etc/apt/apt.conf.d/${ProotFixText.APT_CONF_NAME}"])
    }

    @Test
    fun `arch gets its pacman conf fixed`() {
        Distros.arch(rootfs)
        Fixups().apply(rootfs, Detector().detect(rootfs, null), Hosts.local(dir))
        val conf = File(rootfs, "etc/pacman.conf").readText()
        assertTrue("\nDisableSandbox\n" in conf)
        assertTrue("#DownloadUser = alpm" in conf)
    }

    @Test
    fun `alpine gets no apt file`() {
        Distros.alpine(rootfs)
        Fixups().apply(rootfs, Detector().detect(rootfs, null), Hosts.local(dir))
        assertFalse(File(rootfs, "etc/apt").exists())
        assertTrue(File(rootfs, "etc/hosts").isFile)
    }

    @Test
    fun `busybox alone gets a bin sh link`() {
        Tree(rootfs).exe("bin/busybox")
        val detection = Detector().detect(rootfs, null)
        Fixups().apply(rootfs, detection, Hosts.local(dir))
        assertEquals("/bin/busybox", Files.readSymbolicLink(File(rootfs, "bin/sh").toPath()).toString())
        Fixups().apply(rootfs, detection, Hosts.local(dir))
    }

    private fun snapshot(): Map<String, String> = listOf(
        "etc/resolv.conf", "etc/hosts", "etc/hostname", "etc/apt/apt.conf.d/${ProotFixText.APT_CONF_NAME}",
    ).associateWith { File(rootfs, it).readText() }
}
