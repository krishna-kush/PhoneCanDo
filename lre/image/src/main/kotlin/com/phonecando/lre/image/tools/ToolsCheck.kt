package com.phonecando.lre.image.tools

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.family.InstallLine
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.guest.GuestPath
import com.phonecando.lre.image.record.ImageRecord
import com.phonecando.lre.image.record.RecordStore
import com.phonecando.lre.image.setup.SetupState
import java.io.File

/** The commands an image lacks, and the line that installs them. */
data class MissingTools(
    /** The asked-for commands the guest PATH lacks, in the order asked. */
    val commands: List<String>,
    /** One shell line that installs [commands]; null when none are missing or the package manager is unknown. */
    val installCommand: String?,
) {
    companion object {
        val NONE = MissingTools(emptyList(), null)
    }
}

/** Checks the guest PATH for the commands the host asks about (an agent's tools). */
internal object ToolsCheck {
    // A command name a package can provide: no path, no shell syntax, so the
    // install line built from it stays one plain command.
    private val COMMAND = Regex("[A-Za-z0-9][A-Za-z0-9._+-]*")

    /** [check] on a finished image's recorded detection; an image with no Linux lacks nothing. */
    fun ofImage(layout: ImageLayout, commands: List<String>): MissingTools {
        if (!SetupState.isReady(layout)) throw LreException.NotFound("a finished image at ${layout.root}")
        return when (val record = RecordStore.load(layout) ?: throw LreException.Corrupt("run/image.properties")) {
            ImageRecord.Android -> MissingTools.NONE
            is ImageRecord.Linux -> check(layout.rootfs, record.detection.guestPath, record.detection.os, commands)
        }
    }

    /**
     * Commands, not packages: `rg` is ripgrep's binary.
     *
     * @throws LreException.UnsafeEntry for a command that is not a plain name.
     */
    fun check(rootfs: File, guestPath: String, os: OsInfo, commands: List<String>): MissingTools {
        commands.forEach { if (!COMMAND.matches(it)) throw LreException.UnsafeEntry(it, "not a command name") }
        val fs = GuestFs(rootfs)
        val dirs = GuestPath.dirs(guestPath)
        val missing = commands.distinct().filter { fs.findCommand(it, dirs) == null }
        val install = os.family?.takeIf { missing.isNotEmpty() }?.let(Families::of)
            ?.let { traits -> InstallLine.of(traits, os, missing.map(traits::packageFor)) }
        return MissingTools(missing, install)
    }
}
