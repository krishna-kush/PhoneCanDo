package com.phonecando.lre.image.guest

import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.attribute.PosixFileAttributes
import java.nio.file.attribute.PosixFilePermission

/** What kind of entry a host path is, never following a symlink. */
internal object FileKinds {
    private val EXEC_BITS = setOf(
        PosixFilePermission.OWNER_EXECUTE,
        PosixFilePermission.GROUP_EXECUTE,
        PosixFilePermission.OTHERS_EXECUTE,
    )

    /** The entry's own attributes, or null when it does not exist or cannot be read. */
    fun attributes(path: Path): PosixFileAttributes? = try {
        Files.readAttributes(path, PosixFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
    } catch (_: IOException) {
        null
    }

    /** A regular file with any execute bit: what a guest PATH lookup would run. */
    fun isExecutable(attrs: PosixFileAttributes): Boolean =
        attrs.isRegularFile && attrs.permissions().any { it in EXEC_BITS }

    fun isExecutableFile(path: Path): Boolean = attributes(path)?.let(::isExecutable) ?: false

    fun isPlainFile(path: Path): Boolean = attributes(path)?.isRegularFile ?: false

    fun isDirectory(path: Path): Boolean = attributes(path)?.isDirectory ?: false
}
