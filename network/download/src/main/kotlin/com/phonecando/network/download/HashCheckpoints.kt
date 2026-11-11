package com.phonecando.network.download

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * How far each `.part` file was hashed when its try stopped, kept in memory
 * for the next try in this process: a retry or a Resume then fetches the next
 * byte at once instead of reading gigabytes back first. A checkpoint counts
 * only while the file still has exactly the length it was taken at; after a
 * restart, or anything else, the file is hashed again from disk.
 */
class HashCheckpoints {
    private class Point(val length: Long, val digest: MessageDigest)

    private val byPart = ConcurrentHashMap<String, Point>()

    /** The digest of [part]'s first [length] bytes, if one was kept for exactly that; it is used up. */
    internal fun take(part: File, length: Long): MessageDigest? {
        val point = byPart.remove(key(part)) ?: return null
        return if (point.length == length && part.length() == length) point.digest else null
    }

    /** Keeps a copy of [digest], the hash of [part]'s first [length] bytes. */
    internal fun keep(part: File, length: Long, digest: MessageDigest) {
        byPart[key(part)] = Point(length, digest.clone() as MessageDigest)
    }

    internal fun forget(part: File) {
        byPart.remove(key(part))
    }

    private fun key(part: File): String = part.absolutePath
}
