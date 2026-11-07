package com.phonecando.lre.oci.auth

/**
 * Anonymous pull tokens per registry + repository, kept until shortly
 * before they expire. Thread-safe.
 */
internal class TokenCache(private val nowMillis: () -> Long) {
    private class Entry(val token: String, val expiresAt: Long)

    private val entries = HashMap<String, Entry>()

    @Synchronized
    fun get(key: String): String? {
        val entry = entries[key] ?: return null
        if (nowMillis() >= entry.expiresAt) {
            entries.remove(key)
            return null
        }
        return entry.token
    }

    /** Keeps [token] for [ttlSeconds] minus a safety margin (a token must not lapse mid-request). */
    @Synchronized
    fun put(key: String, token: String, ttlSeconds: Long) {
        val ttlMillis = ttlSeconds.coerceAtLeast(1) * 1000
        val margin = minOf(30_000L, ttlMillis / 4)
        entries[key] = Entry(token, nowMillis() + ttlMillis - margin)
    }

    @Synchronized
    fun drop(key: String) {
        entries.remove(key)
    }
}
