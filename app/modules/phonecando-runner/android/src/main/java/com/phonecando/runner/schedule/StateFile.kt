package com.phonecando.runner.schedule

import java.io.File
import java.io.IOException

// One file under files/state/ written whole and atomically: the new text
// goes to a sibling temp file, then a rename replaces the old one, so a
// crash mid-write leaves the last good file. Missing reads as null. Plain
// JVM IO.
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
    tmp.writeText(text)
    if (!tmp.renameTo(file)) {
      tmp.delete()
      throw IOException("could not replace ${file.name}")
    }
  }
}
