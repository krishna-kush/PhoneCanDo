package com.phonecando.runner.messages.delivery

import java.io.File
import java.nio.file.Files

// An agent's inbox folder, <home>/.phonecando/inbox-<agentId>/ (the agents
// on one machine share HOME; an image kind's guest sees it under /root),
// whose path the engine gets as PHONECANDO_INBOX. While the agent has
// undelivered messages it holds pending/:
//   ids             the message ids, one per line
//   messages.jsonl  one JSON object per message (for an extension that reads them)
//   messages.txt    what the model reads (the rendered blocks)
//   <Event>.out     what `phonecando-inbox <Event>` prints, per hook event of the kind
//   <Event>.exit    that event's exit code, when not 0
//   wake            only when these messages may wake the agent
// Each write builds the next pending/ in a hidden folder beside it and
// swaps it in (the old one renamed away, then the new one renamed into
// place, then the old one removed), so a reader's `mv pending claimed.$$`
// gets one whole set or none. Everything else in the folder (the kit
// script's own files: `waiter`, its claimed.* while it runs) is left alone,
// except that prepare() at an engine start removes claimed.*, our own
// half-done folders and the `waiter` an earlier life left behind: that
// life's hooks were stopped with its engine, and a `waiter` left over would
// read as a hook ready to wake the new one (waiterAlive). Pure JVM.
class InboxFolder(val dir: File) {
  val pending: File get() = File(dir, PENDING)

  fun hasPending(): Boolean = pending.isDirectory

  /** A hook is waiting to wake the agent (phonecando-inbox --wait wrote its pid to `waiter`). */
  fun waiterAlive(): Boolean = File(dir, WAITER).isFile

  /** Replaces pending/ with [files] (name to content) and, when [wake], the wake mark. */
  fun write(files: Map<String, String>, wake: Boolean) {
    dir.mkdirs()
    val stamp = "${System.nanoTime()}"
    val next = File(dir, "$NEXT$stamp")
    next.mkdirs()
    try {
      for ((name, content) in files) {
        require(FILE_NAME.matches(name)) { "bad inbox file name $name" }
        File(next, name).writeText(content, Charsets.UTF_8)
      }
      if (wake) File(next, WAKE).writeBytes(ByteArray(0))
      val old = File(dir, "$OLD$stamp")
      // Gone already when a reader claimed it meanwhile: nothing to set aside.
      val setAside = pending.exists() && pending.renameTo(old)
      if (!next.renameTo(pending)) throw java.io.IOException("could not put ${pending.name} in place")
      if (setAside) TreeDelete.of(old)
    } finally {
      TreeDelete.of(next)
    }
  }

  /**
   * The ids in the sets a hook or reader is handing over right now (the
   * ids file of each claimed.<pid> folder, there until it has written its
   * receipt): a rebuilt pending/ leaves them out.
   */
  fun inFlight(): Set<Long> {
    val out = HashSet<Long>()
    for (child in dir.listFiles().orEmpty()) {
      if (!child.name.startsWith(CLAIMED) || Files.isSymbolicLink(child.toPath())) continue
      val ids = File(child, IDS)
      if (Files.isSymbolicLink(ids.toPath()) || !ids.isFile || ids.length() > MAX_IDS_BYTES) continue
      try {
        ids.readText(Charsets.UTF_8).split('\n', ' ', '\t').mapNotNullTo(out) { it.trim().toLongOrNull() }
      } catch (_: java.io.IOException) {
        // Gone meanwhile: handed over.
      }
    }
    return out
  }

  /** No pending/ (read or delivered meanwhile). */
  fun clear() {
    if (!pending.exists()) return
    val gone = File(dir, "$OLD${System.nanoTime()}")
    if (pending.renameTo(gone)) TreeDelete.of(gone)
  }

  /** The folder made; claimed.* and our own half-done folders from an earlier engine life removed. */
  fun prepare() {
    dir.mkdirs()
    for (child in dir.listFiles().orEmpty()) {
      val name = child.name
      if (name.startsWith(CLAIMED) || name.startsWith(NEXT) || name.startsWith(OLD) || name == WAITER) TreeDelete.of(child)
    }
  }

  companion object {
    const val PENDING = "pending"
    const val WAITER = "waiter"
    const val WAKE = "wake"
    const val IDS = "ids"
    const val JSONL = "messages.jsonl"
    const val TEXT = "messages.txt"
    const val OUT = ".out"
    const val EXIT = ".exit"
    private const val CLAIMED = "claimed."
    private const val NEXT = ".pending-next."
    private const val OLD = ".pending-old."
    private const val MAX_IDS_BYTES = 64 * 1024L

    /** Where an agent's inbox is in HOME (host or guest path alike). */
    const val FOLDER = ".phonecando/inbox-"

    fun of(home: File, agentId: String) = InboxFolder(dir(home, agentId))

    fun dir(home: File, agentId: String) = File(home, "$FOLDER$agentId")

    /** A hook event's name as phonecando-inbox takes it: 1 to 64 of A-Z a-z 0-9 . _ : -, starting with a letter or digit. */
    fun safeName(name: String): Boolean = EVENT_NAME.matches(name)

    private val EVENT_NAME = Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,63}")
    private val FILE_NAME = Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,72}")
  }
}
