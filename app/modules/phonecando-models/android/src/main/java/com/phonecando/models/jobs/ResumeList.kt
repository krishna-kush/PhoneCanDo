package com.phonecando.models.jobs

import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * The downloads to run again when the app starts. One goes on the list when
 * it starts or resumes and comes off when it ends for good: done, paused or
 * deleted by the user, or failed in a way a later try cannot fix. One left
 * on it was stopped by the process ending or by a network that stayed down.
 * One id per line in [file], our own state (lme's models dir stays lme's).
 * A file we cannot read or write only means nothing resumes by itself.
 */
class ResumeList(private val file: File) {
  private val lock = Any()

  fun ids(): List<String> = synchronized(lock) { read() }

  fun add(id: String) = synchronized(lock) {
    val ids = read()
    if (id !in ids) write(ids + id)
  }

  fun remove(id: String) = synchronized(lock) {
    val ids = read()
    if (id in ids) write(ids - id)
  }

  private fun read(): List<String> = try {
    if (file.isFile) file.readLines().map(String::trim).filter(String::isNotEmpty) else emptyList()
  } catch (_: IOException) {
    emptyList()
  }

  private fun write(ids: List<String>) {
    val dir = file.absoluteFile.parentFile ?: return
    val tmp = File(dir, "${file.name}.tmp")
    try {
      dir.mkdirs()
      FileOutputStream(tmp).use { out ->
        out.write(ids.joinToString("") { "$it\n" }.toByteArray(Charsets.UTF_8))
        out.fd.sync()
      }
      if (!tmp.renameTo(file)) tmp.delete()
    } catch (_: IOException) {
      tmp.delete()
    }
  }
}
