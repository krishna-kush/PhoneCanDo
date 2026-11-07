package com.phonecando.lre.image.detect

import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.files.TextFiles
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.guest.GuestPath
import java.io.File

/**
 * Reads an unpacked base and says what it is. It looks only at the image
 * itself (its config, os-release, the binaries on its PATH), never at a
 * table of known distros.
 */
internal class Detector {
    /** @throws LreException.NoShell when the image has no bash, sh, ash or busybox. */
    fun detect(rootfs: File, config: ImageConfig?): Detection {
        val fs = GuestFs(rootfs)
        val dirs = GuestPath.dirs(ImageEnv.guestPath(config))
        val release = osRelease(fs)
        val family = Families.all.firstOrNull { fs.findCommand(it.binary, dirs) != null }?.family

        val bash = findShell(fs, "bash", dirs)
        val sh = findShell(fs, "sh", dirs)
        val ash = if (bash == null && sh == null) findShell(fs, "ash", dirs) else null
        val busybox = if (bash == null && sh == null && ash == null) findShell(fs, "busybox", dirs) else null
        val shell = bash ?: sh ?: ash ?: busybox?.let { BIN_SH } ?: throw LreException.NoShell()

        val os = OsInfo(
            id = release["ID"]?.takeIf { it.isNotBlank() } ?: "linux",
            versionId = release["VERSION_ID"]?.takeIf { it.isNotBlank() },
            idLike = release["ID_LIKE"].orEmpty().split(' ', '\t').filter { it.isNotEmpty() },
            prettyName = (release["PRETTY_NAME"] ?: release["NAME"])?.takeIf { it.isNotBlank() },
            family = family,
            shell = shell,
        )
        return Detection(
            os = os,
            config = config,
            hasBash = bash != null,
            hasSh = sh != null || busybox != null,
            busyboxSh = busybox,
        )
    }

    /** `/bin/<name>` when it runs, else the first one on the guest PATH. */
    private fun findShell(fs: GuestFs, name: String, dirs: List<String>): String? =
        "/bin/$name".takeIf(fs::isExecutable) ?: fs.findCommand(name, dirs)

    private fun osRelease(fs: GuestFs): Map<String, String> {
        for (path in OS_RELEASE) {
            val host = fs.resolve(path) ?: continue
            val text = TextFiles.read(host, OS_RELEASE_LIMIT) ?: continue
            return OsRelease.parse(text)
        }
        return emptyMap()
    }

    private companion object {
        const val BIN_SH = "/bin/sh"
        val OS_RELEASE = listOf("/etc/os-release", "/usr/lib/os-release")
        const val OS_RELEASE_LIMIT = 64L * 1024
    }
}
