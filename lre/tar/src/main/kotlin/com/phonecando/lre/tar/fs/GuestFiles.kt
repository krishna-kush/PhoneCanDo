package com.phonecando.lre.tar.fs

import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributeView
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.FileTime
import java.nio.file.attribute.PosixFileAttributeView
import java.nio.file.attribute.PosixFilePermission

/** File operations that never follow a symlink at the path they are given. */
internal object GuestFiles {
    private val NOFOLLOW = LinkOption.NOFOLLOW_LINKS

    fun lstat(path: Path): BasicFileAttributes? = try {
        Files.readAttributes(path, BasicFileAttributes::class.java, NOFOLLOW)
    } catch (e: NoSuchFileException) {
        null
    }

    /** Deletes a file, a symlink (not its target) or a whole tree, never crossing a symlink. */
    fun deleteTree(path: Path) {
        Files.walkFileTree(
            path,
            object : SimpleFileVisitor<Path>() {
                override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                    Files.delete(file)
                    return FileVisitResult.CONTINUE
                }

                override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
                    if (exc != null) throw exc
                    Files.delete(dir)
                    return FileVisitResult.CONTINUE
                }
            },
        )
    }

    fun setPermissions(path: Path, permissions: Set<PosixFilePermission>) {
        // Null on a filesystem without POSIX modes; nothing to set there.
        Files.getFileAttributeView(path, PosixFileAttributeView::class.java, NOFOLLOW)?.setPermissions(permissions)
    }

    fun setMtime(path: Path, time: FileTime) {
        // Passing atime too saves the stat the JDK does to keep it.
        Files.getFileAttributeView(path, BasicFileAttributeView::class.java, NOFOLLOW).setTimes(time, time, null)
    }

    /** Symlink times need lutimes; a platform without it keeps the link's creation time. */
    fun setLinkMtime(path: Path, time: FileTime) {
        try {
            setMtime(path, time)
        } catch (e: IOException) {
            Unit
        } catch (e: UnsupportedOperationException) {
            Unit
        }
    }
}
