package com.phonecando.network.http

/**
 * The IETF `RateLimit` header (Hugging Face sends it): one item per policy,
 * `"api";r=495;t=32` for 495 calls left in the next 32 seconds. Pure.
 */
object RateLimitHeader {
    /** What is left of a policy: [calls] until the window ends in [resetSeconds]. */
    data class Left(val calls: Int, val resetSeconds: Long)

    /** What is left of policy [name]; null when [header] has none we can read. */
    fun policy(header: String?, name: String): Left? = policies(header)[name]

    /** The wait until the first used-up policy (no calls left) resets; null when none is. */
    fun exhausted(header: String?): Long? = policies(header).values.firstOrNull { it.calls == 0 }?.resetSeconds

    private fun policies(header: String?): Map<String, Left> {
        if (header.isNullOrBlank()) return emptyMap()
        val out = LinkedHashMap<String, Left>()
        for (item in header.split(',')) {
            val parts = item.split(';').map(String::trim)
            val name = parts.first().takeIf { it.length >= 2 && it.startsWith('"') && it.endsWith('"') }?.trim('"') ?: continue
            val params = parts.drop(1).mapNotNull { p -> p.split('=', limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }.toMap()
            val calls = params["r"]?.toIntOrNull()?.takeIf { it >= 0 } ?: continue
            val reset = params["t"]?.toLongOrNull()?.takeIf { it >= 0 } ?: continue
            out.putIfAbsent(name, Left(calls, reset))
        }
        return out
    }
}
