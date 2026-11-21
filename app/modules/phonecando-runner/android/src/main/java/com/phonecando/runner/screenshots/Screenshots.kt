package com.phonecando.runner.screenshots

import android.os.SystemClock
import java.io.File

// The screenshots agents' looks leave on disk, deleted when ShotBook says.
// The PCE's Android backend writes them to cache/pce-screenshots (FOLDER);
// when the bridge starts or stops nothing there is anyone's, so it is
// emptied. Full builds take them (uiauto/appgate/ records each one), the
// bridge says when the screen moves or an agent is done.
object Screenshots {
  const val FOLDER = "pce-screenshots"

  private val book = ShotBook()

  fun taken(agentId: String, path: String) = delete(book.taken(agentId, path, now()))

  fun screenTo(agentId: String) = delete(book.screenTo(agentId))

  fun ended(agentId: String) = delete(book.ended(agentId))

  fun sweep() = delete(book.expired(now()))

  fun clear(cacheDir: File) {
    book.all()
    File(cacheDir, FOLDER).listFiles()?.forEach { runCatching { it.delete() } }
  }

  private fun now() = SystemClock.elapsedRealtime()

  private fun delete(paths: List<String>) = paths.forEach { runCatching { File(it).delete() } }
}
