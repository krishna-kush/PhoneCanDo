package com.phonecando.runner.models.chats

// Which saved chats go, newest kept: past the most a model keeps
// (StoredChats.MOST in lme), and before a save, the oldest until the save
// still leaves the margin free on storage. Pure.
internal object ChatKeep {
  /** A saved chat on storage: its file's name, when it was last used, its size. */
  data class Saved(val name: String, val usedAt: Long, val bytes: Long)

  /** The names past the [most] newest of [saved], oldest first. */
  fun overCap(saved: List<Saved>, most: Int): List<String> =
    saved.sortedByDescending { it.usedAt }.drop(most).sortedBy { it.usedAt }.map { it.name }

  /**
   * Before saving a chat of up to [chatBytes] with [freeBytes] free: the
   * oldest of [saved] to delete first so that [marginBytes] stay free
   * after it, and whether that is enough ([Room.fits]: else skip the save).
   */
  fun room(saved: List<Saved>, freeBytes: Long, chatBytes: Long, marginBytes: Long): Room {
    var free = freeBytes
    val drop = ArrayList<String>()
    for (s in saved.sortedBy { it.usedAt }) {
      if (free - chatBytes >= marginBytes) break
      drop += s.name
      free += s.bytes
    }
    return Room(drop, free - chatBytes >= marginBytes)
  }

  data class Room(val drop: List<String>, val fits: Boolean)
}
