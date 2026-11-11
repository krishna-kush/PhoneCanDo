package com.phonecando.lme.catalog.hub

/**
 * The Hub's `RateLimit` header (the IETF RateLimit fields): one item per
 * policy, `"api";r=495;t=32` for 495 calls left in the next 32 seconds.
 * Pure.
 */
internal object RateLimitHeader {
    /** What is left of a policy: [calls] until the window ends in [resetSeconds]. */
    data class Left(val calls: Int, val resetSeconds: Long)

    /** What is left of the API's policy (search, repositories); null when [header] has none we can read. */
    fun api(header: String?): Left? {
        val item = header?.split(',')?.map { it.split(';').map(String::trim) }?.firstOrNull { it.first() == "\"$API\"" } ?: return null
        val params = item.drop(1).mapNotNull { p -> p.split('=', limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }.toMap()
        val calls = params["r"]?.toIntOrNull()?.takeIf { it >= 0 } ?: return null
        val reset = params["t"]?.toLongOrNull()?.takeIf { it >= 0 } ?: return null
        return Left(calls, reset)
    }

    private const val API = "api"
}
