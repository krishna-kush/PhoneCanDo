package com.phonecando.runner.checks.life

import java.io.File
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

// S6: whether the agent kept anything in its own state folder this engine
// life. The launch seeds that folder (its config, our note in its
// instructions file, AgentFiles.makeState), so "not empty" would always
// hold; we ask instead whether an entry there changed after [since] (the
// launch, which comes after that seeding), or whether it holds more than
// MAX_ENTRIES, far more than we seed. [ignore] are the paths other
// agents' launches write (the machine note in its instructions file, and
// that file's folder): those never count. Walks without following links.
// Plain JVM IO.
internal class StateProbe(private val dir: File, private val since: Long, private val ignore: Set<Path> = emptySet()) {
  fun wrote(): Boolean {
    if (!dir.isDirectory) return false
    var seen = 0
    var found = false
    val visitor = object : SimpleFileVisitor<Path>() {
      override fun preVisitDirectory(path: Path, attrs: BasicFileAttributes) = look(path, attrs)

      override fun visitFile(path: Path, attrs: BasicFileAttributes) = look(path, attrs)

      override fun visitFileFailed(path: Path, exc: IOException) = FileVisitResult.CONTINUE

      private fun look(path: Path, attrs: BasicFileAttributes): FileVisitResult {
        if (++seen > MAX_ENTRIES || (path.normalize() !in ignore && attrs.lastModifiedTime().toMillis() > since)) {
          found = true
          return FileVisitResult.TERMINATE
        }
        return FileVisitResult.CONTINUE
      }
    }
    try {
      Files.walkFileTree(dir.toPath().normalize(), emptySet(), MAX_DEPTH, visitor)
    } catch (_: IOException) {
      // What it saw so far.
    }
    return found
  }

  companion object {
    const val MAX_ENTRIES = 4096
    const val MAX_DEPTH = 8

    /** The probe for [stateDir], launched at [since]; [instructions]: the kind's instructions file in it, if any. */
    fun of(stateDir: File, since: Long, instructions: File?): StateProbe {
      val ignore = listOfNotNull(instructions, instructions?.parentFile).map { it.toPath().normalize() }.toSet()
      return StateProbe(stateDir, since, ignore)
    }
  }
}
