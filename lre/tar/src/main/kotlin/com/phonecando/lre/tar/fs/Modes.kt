package com.phonecando.lre.tar.fs

import java.nio.file.attribute.PosixFilePermission
import java.util.EnumSet

/**
 * Tar mode bits to the permissions we set. Only the 0777 bits survive
 * (setuid, setgid and sticky mean nothing for one uid under a fake root),
 * and the owner can always read and write files and enter and change dirs:
 * a 0555 dir from the archive would otherwise block later entries and apt.
 */
internal object Modes {
    private const val PERMISSION_BITS = 0b111_111_111
    private const val OWNER_RW = 0b110_000_000
    private const val OWNER_RWX = 0b111_000_000

    /** Dirs the archive never listed but a member needs (0755). */
    const val IMPLICIT_DIR = 0b111_101_101

    fun file(mode: Int): Set<PosixFilePermission> = toPermissions((mode and PERMISSION_BITS) or OWNER_RW)

    fun dir(mode: Int): Set<PosixFilePermission> = toPermissions((mode and PERMISSION_BITS) or OWNER_RWX)

    fun toPermissions(bits: Int): Set<PosixFilePermission> {
        val set = EnumSet.noneOf(PosixFilePermission::class.java)
        for ((i, permission) in BIT_ORDER.withIndex()) if (bits and (1 shl (8 - i)) != 0) set += permission
        return set
    }

    /** rwxrwxrwx, from bit 8 down to bit 0. */
    private val BIT_ORDER = listOf(
        PosixFilePermission.OWNER_READ,
        PosixFilePermission.OWNER_WRITE,
        PosixFilePermission.OWNER_EXECUTE,
        PosixFilePermission.GROUP_READ,
        PosixFilePermission.GROUP_WRITE,
        PosixFilePermission.GROUP_EXECUTE,
        PosixFilePermission.OTHERS_READ,
        PosixFilePermission.OTHERS_WRITE,
        PosixFilePermission.OTHERS_EXECUTE,
    )
}
