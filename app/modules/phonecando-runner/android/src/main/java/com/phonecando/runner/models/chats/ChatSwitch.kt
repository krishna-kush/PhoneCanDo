package com.phonecando.runner.models.chats

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock

// The model server's one slot, taken by one request at a time (fair: in
// the order they came), and the chat it holds. Before a request of another
// chat runs, the chat there is saved to storage and the request's own, if
// saved, is loaded back (ChatFiles); a save or a load that fails changes
// nothing for the request: the server reads what it must. After
// [MAX_FAILED_SAVES] failed saves in a row it stops saving for this run
// and says so ([onFailing]): its next start keeps chats in RAM.
internal class ChatSwitch(
  private val files: ChatFiles,
  /** The server saves its slot as this file name in the chats dir. */
  private val save: (filename: String) -> Boolean,
  /** The server loads its slot from this file name. */
  private val restore: (filename: String) -> Boolean,
  private val onFailing: () -> Unit = {},
  private val log: (String) -> Unit = {},
) {
  private val lock = ReentrantLock(true)

  // The chat the slot holds (null: none we can name) and whether it holds anything.
  private var live: String? = null
  private var holds = false
  private var failedSaves = 0
  private var saving = true

  /** Waits for the slot, giving up when [gone] says the caller left; true once it is ours. */
  fun acquire(gone: () -> Boolean): Boolean {
    while (!lock.tryLock(WAIT_STEP_MS, TimeUnit.MILLISECONDS)) {
      if (gone()) return false
    }
    return true
  }

  fun release() = lock.unlock()

  /**
   * With the slot held, readies it for a request of chat [key] (null: a
   * request we cannot name): the live chat saved, [key]'s loaded back.
   */
  fun switchTo(key: String?) {
    check(lock.isHeldByCurrentThread) { "the slot is not held" }
    if (key != null && key == live) return
    saveLive()
    if (key != null && files.has(key)) {
      if (restore(files.savedName(key))) {
        files.used(key)
        log("chat ${short(key)} loaded back from storage")
      } else {
        // The server cleared its slot; a file it would not take goes.
        files.drop(key)
        log("chat ${short(key)} would not load; it is read again")
      }
    }
    live = key
    holds = true
  }

  /** Saves the live chat when the slot is free within [waitMs] (the server is about to stop). */
  fun saveBeforeStop(waitMs: Long) {
    if (!lock.tryLock(waitMs, TimeUnit.MILLISECONDS)) return
    try {
      saveLive()
      live = null
      holds = false
    } finally {
      lock.unlock()
    }
  }

  /** The chat the slot holds now; null for none we can name. */
  fun live(): String? = live

  private fun saveLive() {
    val key = live ?: return
    if (!holds || !saving) return
    if (!files.makeRoom()) {
      log("no room on storage to keep chat ${short(key)}")
      return
    }
    if (save(files.tempName(key)) && files.commit(key)) {
      failedSaves = 0
      log("chat ${short(key)} kept on storage")
      return
    }
    files.abandon(key)
    failedSaves++
    log("chat ${short(key)} could not be kept on storage")
    if (failedSaves >= MAX_FAILED_SAVES) {
      saving = false
      onFailing()
    }
  }

  private fun short(key: String) = key.take(8)

  companion object {
    const val MAX_FAILED_SAVES = 3
    private const val WAIT_STEP_MS = 250L
  }
}
