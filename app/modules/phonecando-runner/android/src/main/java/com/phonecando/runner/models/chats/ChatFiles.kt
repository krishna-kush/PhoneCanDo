package com.phonecando.runner.models.chats

import com.phonecando.lme.host.chats.StoredChats
import java.io.File
import java.io.IOException

// One model's saved chats on storage: files/models/<id>/.chats/ (lme's
// ModelLayout, gone with the model), one <key>.bin per chat as the server
// wrote it, private to us (0600; the server makes them 0666), and a shape
// file (ChatShape) that, when a start's differs, empties the dir first. The
// server saves under <key>.tmp; only a whole save is renamed to <key>.bin.
// At most StoredChats.MOST are kept, the least recently used going first,
// and before a save the oldest go until the save leaves the margin free
// (ChatKeep).
internal class ChatFiles(
  val dir: File,
  private val chatBytes: Long,
  private val free: () -> Long = { dir.usableSpace },
  private val clock: () -> Long = System::currentTimeMillis,
) {
  /** Makes the dir private and empties it when [shape] is not the one its chats were saved with. */
  fun prepare(shape: String) {
    if (!dir.isDirectory && !dir.mkdirs()) throw IOException("cannot make $dir")
    private(dir, directory = true)
    val marker = File(dir, SHAPE)
    val was = try {
      if (marker.isFile) marker.readText() else null
    } catch (_: IOException) {
      null
    }
    if (was != shape) {
      dir.listFiles().orEmpty().filter { it.name != SHAPE }.forEach { it.delete() }
      marker.writeText(shape)
    }
    // What a save cut short left.
    dir.listFiles().orEmpty().filter { it.name.endsWith(TEMP) }.forEach { it.delete() }
  }

  fun has(key: String): Boolean = file(key).isFile

  /** The name the server saves [key] under, in the dir it was given. */
  fun tempName(key: String): String = "$key$TEMP"

  fun savedName(key: String): String = "$key$SAVED"

  /** Deletes the oldest until a save leaves the margin free; false when even that is not enough. */
  fun makeRoom(): Boolean {
    val room = ChatKeep.room(saved(), free(), chatBytes, StoredChats.FREE_MARGIN_BYTES)
    room.drop.forEach { File(dir, it).delete() }
    return room.fits
  }

  /** The server saved [key] under its temp name: it becomes the chat's file, private and newest, past the cap the oldest go. */
  fun commit(key: String): Boolean {
    val temp = File(dir, tempName(key))
    if (!temp.isFile) return false
    private(temp, directory = false)
    if (!temp.renameTo(file(key))) {
      temp.delete()
      return false
    }
    used(key)
    ChatKeep.overCap(saved(), StoredChats.MOST).forEach { File(dir, it).delete() }
    return true
  }

  /** A save that failed: what it left. */
  fun abandon(key: String) {
    File(dir, tempName(key)).delete()
  }

  /** [key] was loaded back: it is the newest. */
  fun used(key: String) {
    file(key).setLastModified(clock())
  }

  /** A file the server would not load: it goes. */
  fun drop(key: String) {
    file(key).delete()
  }

  fun saved(): List<ChatKeep.Saved> = dir.listFiles().orEmpty()
    .filter { it.isFile && it.name.endsWith(SAVED) }
    .map { ChatKeep.Saved(it.name, it.lastModified(), it.length()) }

  private fun file(key: String) = File(dir, savedName(key))

  // Ours alone: 0600 for a file, 0700 for the dir.
  private fun private(f: File, directory: Boolean) {
    f.setReadable(false, false)
    f.setWritable(false, false)
    f.setExecutable(false, false)
    f.setReadable(true, true)
    f.setWritable(true, true)
    if (directory) f.setExecutable(true, true)
  }

  companion object {
    const val SHAPE = "shape"
    const val SAVED = ".bin"
    const val TEMP = ".tmp"
  }
}
