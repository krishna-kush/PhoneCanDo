package com.phonecando.lre.image.fixup

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.family.ProotFix
import com.phonecando.lre.image.family.ProotFixText
import com.phonecando.lre.image.files.TextFiles
import com.phonecando.lre.image.guest.FileKinds
import com.phonecando.lre.image.guest.GuestFs
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Makes an unpacked base work under proot on a phone: DNS, hosts and
 * hostname, the package manager's proot fix and, for a busybox-only image,
 * a `/bin/sh` link. Every write lands inside the rootfs (guest paths are
 * resolved guest-side) and replaces a symlink rather than writing through
 * it. Idempotent.
 */
internal class Fixups {
    fun apply(rootfs: File, detection: Detection, host: HostEnv) {
        val fs = GuestFs(rootfs)
        writeResolvConf(fs, host)
        writeEtc(fs, "hosts", NetFiles.hosts())
        writeEtc(fs, "hostname", NetFiles.hostname())
        detection.os.family?.let { Families.of(it).prootFix }?.let { applyProotFix(fs, it) }
        detection.busyboxSh?.let { linkBinSh(fs, it) }
    }

    /** Only the DNS part: the phone's network changes between starts. */
    fun writeResolvConf(rootfs: File, host: HostEnv) = writeResolvConf(GuestFs(rootfs), host)

    private fun writeResolvConf(fs: GuestFs, host: HostEnv) {
        writeEtc(fs, "resolv.conf", NetFiles.resolvConf(host.dnsServers))
    }

    private fun writeEtc(fs: GuestFs, name: String, text: String) {
        val etc = dir(fs, "/etc") ?: return
        TextFiles.write(etc.resolve(name).toFile(), text)
    }

    private fun applyProotFix(fs: GuestFs, fix: ProotFix) {
        when (fix) {
            ProotFix.APT_SANDBOX_USER -> {
                if (!fs.isDirectory("/etc/apt")) return
                val confD = dir(fs, "/etc/apt/apt.conf.d") ?: return
                TextFiles.write(confD.resolve(ProotFixText.APT_CONF_NAME).toFile(), ProotFixText.APT_CONF)
            }
            ProotFix.PACMAN_SANDBOX -> {
                val conf = fs.resolve("/etc/pacman.conf") ?: return
                val text = TextFiles.read(conf) ?: return
                TextFiles.write(conf.toFile(), ProotFixText.pacmanConf(text))
            }
        }
    }

    private fun linkBinSh(fs: GuestFs, busybox: String) {
        val sh = fs.resolveName("/bin/sh") ?: return
        if (FileKinds.attributes(sh) != null) return
        val bin = dir(fs, "/bin") ?: return
        Files.createSymbolicLink(bin.resolve("sh"), Paths.get(busybox))
    }

    /** Host path of guest dir [guestPath], created (inside the rootfs) when missing; null when blocked. */
    private fun dir(fs: GuestFs, guestPath: String): Path? {
        val host = fs.resolve(guestPath) ?: return null
        val attrs = FileKinds.attributes(host)
        if (attrs == null) Files.createDirectories(host) else if (!attrs.isDirectory) return null
        return host
    }
}
