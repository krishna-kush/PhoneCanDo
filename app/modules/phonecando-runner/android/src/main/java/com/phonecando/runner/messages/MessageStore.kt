package com.phonecando.runner.messages

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

// The message log in app-private storage (files/state/messages.jsonl, never
// inside a machine an agent can write): one JSON line per change of a
// message, the last line of an id wins. load() compacts it on start: one
// line per message, the newest 500 and none older than 7 days
// (MessageRules), after a `{"seq":N}` line that keeps the sequence going
// when every message has aged out. A rewrite goes to a temp file, synced,
// renamed over the log, so a crash mid-write leaves the old one whole; a
// line that does not parse is skipped. Mailbox calls it under its lock.
// Pure JVM.
class MessageStore(private val file: File) {
  /** Lines appended since the last rewrite; the mailbox compacts past [COMPACT_LINES]. */
  var appended = 0
    private set

  /** The messages kept (oldest first) and the next id, after compacting the file. */
  fun load(now: Long): Loaded {
    var seq = 0L
    val byId = LinkedHashMap<Long, Message>()
    try {
      file.forEachLine(Charsets.UTF_8) { line ->
        if (line.isBlank()) return@forEachLine
        val o = try {
          JSONObject(line)
        } catch (_: Exception) {
          return@forEachLine
        }
        if (o.has(SEQ)) {
          seq = maxOf(seq, o.optLong(SEQ, 0L))
          return@forEachLine
        }
        val m = MessageJson.read(o) ?: return@forEachLine
        byId.remove(m.id)
        byId[m.id] = m
      }
    } catch (_: IOException) {
      // No log yet.
    }
    val all = byId.values.sortedBy { it.id }
    val next = maxOf(seq, (all.lastOrNull()?.id ?: 0L) + 1, 1L)
    val kept = trim(all, now)
    try {
      rewrite(kept, next)
    } catch (_: IOException) {
      // Read again next start.
    }
    return Loaded(kept, next)
  }

  data class Loaded(val messages: List<Message>, val nextId: Long)

  /** One more line for [m] (new or changed). */
  fun append(m: Message) {
    file.absoluteFile.parentFile?.mkdirs()
    FileOutputStream(file, true).use { it.write((MessageJson.write(m).toString() + "\n").toByteArray(Charsets.UTF_8)) }
    appended++
  }

  /** The whole log as [messages], one line each, after the sequence line. */
  fun rewrite(messages: List<Message>, nextId: Long) {
    val dir = file.absoluteFile.parentFile ?: throw IOException("no folder for ${file.name}")
    dir.mkdirs()
    val tmp = File(dir, "${file.name}.tmp")
    try {
      FileOutputStream(tmp).use { out ->
        val text = StringBuilder()
        text.append(JSONObject().put(SEQ, nextId).toString()).append('\n')
        for (m in messages) text.append(MessageJson.write(m).toString()).append('\n')
        out.write(text.toString().toByteArray(Charsets.UTF_8))
        out.fd.sync()
      }
      if (!tmp.renameTo(file)) throw IOException("could not replace ${file.name}")
    } catch (e: IOException) {
      tmp.delete()
      throw e
    }
    appended = 0
  }

  companion object {
    private const val SEQ = "seq"

    /** Appended lines past which the mailbox rewrites the log. */
    const val COMPACT_LINES = 4 * MessageRules.LOG_MAX

    /** [messages] (oldest first) within the caps: the newest LOG_MAX, none older than LOG_MAX_AGE_MS. */
    fun trim(messages: List<Message>, now: Long): List<Message> =
      messages.filter { now - it.sentAt <= MessageRules.LOG_MAX_AGE_MS }.takeLast(MessageRules.LOG_MAX)
  }
}
