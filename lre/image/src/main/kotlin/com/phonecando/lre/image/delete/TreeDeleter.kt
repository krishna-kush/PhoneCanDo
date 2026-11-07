package com.phonecando.lre.image.delete

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.attribute.PosixFileAttributes
import java.nio.file.attribute.PosixFilePermission

/**
 * Deletes a tree a guest wrote. A symlink is removed as a link and never
 * followed (an image is full of links to `/`-rooted guest paths that mean
 * host paths here), and every directory is made owner-rwx before we look
 * inside, since guests leave read-only dirs behind. Iterative, so a deep
 * tree cannot overflow the stack.
 */
class TreeDeleter {
    /** Deletes [target] and everything under it; true when nothing is left. */
    fun delete(target: File, cancel: CancelSignal = CancelSignal.NEVER): Boolean {
        val root = target.toPath()
        val stack = ArrayDeque<Pair<Path, Boolean>>()
        stack.addLast(root to false)
        var clean = true
        while (stack.isNotEmpty()) {
            if (cancel.isCancelled()) throw LreException.Cancelled()
            val (path, listed) = stack.removeLast()
            val attrs = attributes(path) ?: continue
            if (attrs.isDirectory && !listed) {
                ownerRwx(path, attrs)
                stack.addLast(path to true)
                try {
                    Files.newDirectoryStream(path).use { children -> children.forEach { stack.addLast(it to false) } }
                } catch (_: IOException) {
                    clean = false
                }
                continue
            }
            try {
                Files.delete(path)
            } catch (_: NoSuchFileException) {
                // Gone already.
            } catch (_: IOException) {
                clean = false
            }
        }
        return clean && attributes(root) == null
    }

    private fun attributes(path: Path): PosixFileAttributes? = try {
        Files.readAttributes(path, PosixFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
    } catch (_: IOException) {
        null
    }

    /** Called only on a real directory (checked without following), so the chmod cannot land elsewhere. */
    private fun ownerRwx(path: Path, attrs: PosixFileAttributes) {
        val perms = attrs.permissions()
        if (perms.containsAll(OWNER_RWX)) return
        try {
            Files.setPosixFilePermissions(path, perms + OWNER_RWX)
        } catch (_: IOException) {
            // The listing or delete below reports it.
        }
    }

    private companion object {
        val OWNER_RWX = setOf(
            PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE,
            PosixFilePermission.OWNER_EXECUTE,
        )
    }
}
