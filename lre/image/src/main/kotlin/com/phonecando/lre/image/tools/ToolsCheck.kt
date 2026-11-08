package com.phonecando.lre.image.tools

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.family.InstallLine
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.guest.GuestPath
import java.io.File

/** The agent's tools an image lacks, and the line that installs them. */
internal data class MissingTools(val commands: List<String>, val installCommand: String?)

/** Checks the guest PATH for the commands the agent leans on. */
internal object ToolsCheck {
    /** Commands, not packages: `rg` is ripgrep's binary. */
    val TOOLS = listOf("bash", "git", "rg")

    fun check(rootfs: File, guestPath: String, os: OsInfo): MissingTools {
        val fs = GuestFs(rootfs)
        val dirs = GuestPath.dirs(guestPath)
        val missing = TOOLS.filter { fs.findCommand(it, dirs) == null }
        val install = os.family?.takeIf { missing.isNotEmpty() }?.let(Families::of)
            ?.let { traits -> InstallLine.of(traits, os, missing.map(traits::packageFor)) }
        return MissingTools(missing, install)
    }
}
