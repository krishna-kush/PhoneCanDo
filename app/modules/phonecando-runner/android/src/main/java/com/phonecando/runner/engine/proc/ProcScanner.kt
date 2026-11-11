package com.phonecando.runner.engine.proc

import java.io.File

// Lists the processes in /proc with their uid, agent tag and model id. The
// environ of a process is read only when it runs as [myUid]: Android shows
// an app little else (hidepid), and others are unreadable anyway. Entries that
// vanish or cannot be read are skipped. Pure JVM; the root is a parameter
// so tests can hand it a folder.
class ProcScanner(private val root: File = File("/proc")) {
  fun scan(myUid: Int): List<ProcEntry> {
    val names = root.list() ?: return emptyList()
    val out = ArrayList<ProcEntry>()
    for (name in names) {
      val pid = name.toIntOrNull() ?: continue
      val dir = File(root, name)
      val (uid, zombie) = try {
        TaggedProcesses.parseStatus(File(dir, "status").readText(Charsets.UTF_8))
      } catch (_: Exception) {
        null
      } ?: continue
      val (tag, model) = if (uid == myUid && !zombie) {
        try {
          TaggedProcesses.tagsOf(File(dir, "environ").readBytes())
        } catch (_: Exception) {
          null to null
        }
      } else {
        null to null
      }
      out += ProcEntry(pid, uid, zombie, tag, model)
    }
    return out
  }
}
