package com.phonecando.lre.image.fixup

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.files.TextFiles
import com.phonecando.lre.image.guest.GuestFs

/**
 * Keeps an image's hostname before every start: the OS's name goes into
 * /etc/hostname and /etc/hosts and into run/hostname as the one we wrote,
 * unless /etc/hostname holds another valid name, which is then kept as is
 * (like on a PC; /etc/hosts is then the user's to match).
 */
internal object HostnameFiles {
    /** The hostname the guest gets, after writing ours where it is ours to write. */
    fun refresh(layout: ImageLayout, os: OsInfo): String {
        val current = GuestFs(layout.rootfs).resolve("/etc/hostname")?.let { TextFiles.read(it) }
        val written = TextFiles.read(layout.writtenHostname)?.trim()?.ifEmpty { null }
        val auto = Hostname.forOs(os)
        val name = Hostname.choose(current, written, auto)
        if (name == auto) {
            Fixups().writeNames(layout.rootfs, auto)
            TextFiles.write(layout.writtenHostname, NetFiles.hostname(auto))
        }
        return name
    }
}
