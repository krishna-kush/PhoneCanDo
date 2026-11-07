package com.phonecando.linux.images

import android.os.Process
import android.system.Os
import android.system.OsConstants
import android.util.Log
import java.io.File

// Stops everything still running in an image (ImageProcesses) before a reset
// swaps its system or a delete removes it: SIGTERM, up to 3 s to exit, then
// SIGKILL for what is left. The engine is stopped by JS before either job;
// this catches what outlives it (background servers, terminal daemons).
// Blocking: call it on our executor, never the main thread.
internal class ImageReaper(private val proc: File = File("/proc")) {
  fun stopAll(imageRoot: String) {
    val first = find(imageRoot)
    if (first.isEmpty()) return
    signal(first, OsConstants.SIGTERM)
    val deadline = System.currentTimeMillis() + GRACE_MS
    while (System.currentTimeMillis() < deadline && find(imageRoot).isNotEmpty()) Thread.sleep(POLL_MS)
    val left = find(imageRoot)
    if (left.isNotEmpty()) {
      Log.w(TAG, "${left.size} process(es) ignored SIGTERM; killing")
      signal(left, OsConstants.SIGKILL)
    }
  }

  private fun find(imageRoot: String): List<Int> =
    ImageProcesses.select(scan(), imageRoot, Process.myPid(), Process.myUid())

  private fun scan(): List<ImageProcesses.Entry> {
    val myUid = Process.myUid()
    return (proc.list() ?: return emptyList()).mapNotNull { name ->
      val pid = name.toIntOrNull() ?: return@mapNotNull null
      val dir = File(proc, name)
      val (uid, zombie) = try {
        ImageProcesses.parseStatus(File(dir, "status").readText())
      } catch (_: Exception) {
        null
      } ?: return@mapNotNull null
      val image = if (uid == myUid && !zombie) {
        try {
          ImageProcesses.tagOf(File(dir, "environ").readBytes())
        } catch (_: Exception) {
          null
        }
      } else {
        null
      }
      ImageProcesses.Entry(pid, uid, zombie, image)
    }
  }

  private fun signal(pids: List<Int>, sig: Int) {
    for (pid in pids) {
      try {
        Os.kill(pid, sig)
      } catch (_: Exception) {
        // gone already
      }
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoLinux"
    const val GRACE_MS = 3_000L
    const val POLL_MS = 100L
  }
}
