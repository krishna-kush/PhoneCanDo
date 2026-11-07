package com.phonecando.lre.image.tools

import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.guest.GuestPath
import java.io.File

/** The agent's tools an image lacks, and the line that installs them. */
internal data class MissingTools(val commands: List<String>, val installCommand: String?)

/** Checks the guest PATH for the commands the agent leans on. */
internal object ToolsCheck {
    /** Commands, not packages: `rg` is ripgrep's binary. */
    val TOOLS = listOf("bash", "git", "rg")

    fun check(rootfs: File, guestPath: String, family: PackageFamily?): MissingTools {
        val fs = GuestFs(rootfs)
        val dirs = GuestPath.dirs(guestPath)
        val missing = TOOLS.filter { fs.findCommand(it, dirs) == null }
        val install = family?.takeIf { missing.isNotEmpty() }?.let(Families::of)
            ?.let { traits -> traits.installLine(missing.map(traits::packageFor)) }
        return MissingTools(missing, install)
    }
}
