package com.phonecando.lme.store.io

import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

/**
 * Deletes a dir and what is in it without ever following a symlink: a link
 * is removed as a link, whatever it points at stays.
 */
internal object TreeDelete {
    fun delete(dir: Path) {
        if (!Files.exists(dir, java.nio.file.LinkOption.NOFOLLOW_LINKS)) return
        Files.walkFileTree(
            dir,
            object : SimpleFileVisitor<Path>() {
                override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
                    Files.deleteIfExists(file)
                    return FileVisitResult.CONTINUE
                }

                override fun postVisitDirectory(d: Path, e: IOException?): FileVisitResult {
                    if (e != null) throw e
                    Files.deleteIfExists(d)
                    return FileVisitResult.CONTINUE
                }
            },
        )
    }
}
