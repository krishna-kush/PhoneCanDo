package com.phonecando.linux.records

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * One state file, read and written whole. A write goes to a temp file in
 * the same dir, is synced, then renamed over the name, so a kill at any
 * point leaves the old file or the new one, never half of either. Pure JVM.
 */
class RecordFile(val file: File) {
  /** The text, or null when there is no file yet. */
  fun read(): String? = if (file.isFile) file.readText(Charsets.UTF_8) else null

  fun write(text: String) {
    val dir = file.absoluteFile.parentFile ?: throw IOException("$file has no parent dir")
    Files.createDirectories(dir.toPath())
    val tmp = File(dir, ".${file.name}.tmp")
    FileOutputStream(tmp).use { out ->
      out.write(text.toByteArray(Charsets.UTF_8))
      out.fd.sync()
    }
    Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
  }

  /** Moves an unreadable file aside (`<name>.corrupt`) so the next write does not lose it silently. */
  fun quarantine() {
    if (!file.exists()) return
    Files.move(file.toPath(), File(file.path + ".corrupt").toPath(), StandardCopyOption.REPLACE_EXISTING)
  }
}
