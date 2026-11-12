package com.phonecando.runner.messages.delivery

import java.io.File
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

// Deletes a folder in an agent's inbox bottom up without following links:
// the agents can write there, so a link in it is removed as a link, never
// followed into what it points at. Quiet: what cannot go stays. Pure JVM.
internal object TreeDelete {
  fun of(file: File) {
    val root = file.toPath()
    if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return
    try {
      Files.walkFileTree(
        root,
        object : SimpleFileVisitor<Path>() {
          override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
            quietly { Files.deleteIfExists(file) }
            return FileVisitResult.CONTINUE
          }

          override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult {
            quietly { Files.deleteIfExists(file) }
            return FileVisitResult.CONTINUE
          }

          override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
            quietly { Files.deleteIfExists(dir) }
            return FileVisitResult.CONTINUE
          }
        },
      )
    } catch (_: IOException) {
      // Left as it is.
    }
  }

  private inline fun quietly(block: () -> Unit) {
    try {
      block()
    } catch (_: IOException) {
    }
  }
}
