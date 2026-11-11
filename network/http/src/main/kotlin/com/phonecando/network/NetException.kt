package com.phonecando.network

/**
 * Every failure our network code reports. An engine maps it to its own
 * errors at its edge and keeps it as their cause, so the retry rules
 * (network's retry module) still see what happened. A message names the
 * thing, never a secret: URLs go through [com.phonecando.network.http.redactUrl].
 */
sealed class NetException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /** No answer ([status] null), a body that broke, or a status we do not accept. */
    class Network(val url: String, val status: Int?, cause: Throwable? = null) :
        NetException("network error on $url${status?.let { " (http $it)" } ?: ""}", cause)

    /** HTTP 429; [retryAfterSeconds] when the server said how long to wait. */
    class RateLimited(val url: String, val retryAfterSeconds: Long? = null) : NetException("rate limited on $url")

    /** HTTP 404 or 410. */
    class NotFound(val what: String) : NetException("$what not found")

    /** HTTP 401 or 403 from the host we asked (not a CDN a redirect took us to). */
    class AccessDenied(val what: String, val url: String, val status: Int) : NetException("no access to $what")

    /** An answer we cannot use for [what]: not the shape asked for, or past our cap. */
    class BadAnswer(val what: String, cause: Throwable? = null) : NetException("unusable answer for $what", cause)

    class SizeMismatch(val what: String, val expected: Long, val actual: Long) :
        NetException("$what is $actual bytes, expected $expected")

    class DigestMismatch(val what: String, val expected: String, val actual: String) :
        NetException("$what: sha256 mismatch, expected $expected, got $actual")

    class Cancelled : NetException("cancelled")

    companion object {
        /** The NetException behind [e]: itself, or the nearest one in its causes (an engine's mapped error). */
        fun of(e: Throwable): NetException? = generateSequence(e) { it.cause }.take(MAX_CAUSES).firstOrNull { it is NetException } as NetException?

        private const val MAX_CAUSES = 8
    }
}
