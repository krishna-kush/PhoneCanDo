package com.phonecando.runner.schedule

import java.io.File
import java.io.FileOutputStream
import java.io.IOException

// One file under files/state/ written whole and atomically: the new text
// goes to a sibling temp file, synced to the disk, then a rename replaces
// the old one, so a crash mid-write leaves the last good file, and a power
// cut right after a write keeps it (cutoff/ reads its file after one).
// Missing reads as null. Plain JVM IO.
class StateFile(private val file: File) {
  fun read(): String? = try {
    if (file.isFile) file.readText() else null
  } catch (_: IOException) {
    null
  }

  @Throws(IOException::class)
  fun write(text: String) {
    file.parentFile?.mkdirs()
    val tmp = File(file.parentFile, file.name + ".tmp")
    FileOutputStream(tmp).use { out ->
      out.write(text.toByteArray(Charsets.UTF_8))
      out.fd.sync()
    }
    if (!tmp.renameTo(file)) {
      tmp.delete()
      throw IOException("could not replace ${file.name}")
    }
  }
}
