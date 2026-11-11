package com.phonecando.lme.api

/**
 * Every failure the engine reports, typed so the UI can say what went wrong.
 * One from our network code keeps its NetException as the cause ([toLme]).
 * A message names the thing, never a secret: URLs go through [com.phonecando.network.http.redactUrl]
 * first, and a token or API key never reaches one.
 */
sealed class LmeException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /** Not a GGUF file we can serve; [reason] says why, fit for the UI. */
    class InvalidGguf(val reason: String) : LmeException("not a usable GGUF file: $reason")

    /** A GGUF header field past what we read ([limit]): no model we can serve. */
    class TooLarge(val what: String, val limit: Long) : LmeException("$what exceeds $limit")

    /** A server's answer we cannot use for [what]: not the shape its API gives, or past our cap. */
    class BadAnswer(val what: String, cause: Throwable? = null) : LmeException("unusable answer for $what", cause)

    /** Not a model id or repository name; [reason] says why, fit for the UI. */
    class InvalidName(val input: String, val reason: String) : LmeException("invalid name: $reason")

    /** The same model (same source, same files) is already on the phone as [id]. */
    class Exists(val id: String) : LmeException("already on the phone as $id")

    class NoSpace(val needed: Long, val free: Long) : LmeException("needs $needed bytes, $free free")

    class SizeMismatch(val what: String, val expected: Long, val actual: Long, cause: Throwable? = null) :
        LmeException("$what is $actual bytes, expected $expected", cause)

    class DigestMismatch(val what: String, val expected: String, val actual: String, cause: Throwable? = null) :
        LmeException("$what: sha256 mismatch, expected $expected, got $actual", cause)

    class Network(val url: String, val status: Int?, cause: Throwable? = null) :
        LmeException("network error on $url${status?.let { " (http $it)" } ?: ""}", cause)

    /** HTTP 429; [retryAfterSeconds] when the server said how long to wait. */
    class RateLimited(val url: String, val retryAfterSeconds: Long? = null, cause: Throwable? = null) :
        LmeException("rate limited on $url", cause)

    class NotFound(val what: String, cause: Throwable? = null) : LmeException("$what not found", cause)

    /**
     * HTTP 401 or 403: a gated or private repository, or a token without
     * access to it. Hugging Face also answers 401 for a repository that does
     * not exist when no token is sent.
     */
    class AccessDenied(val what: String, cause: Throwable? = null) : LmeException("no access to $what", cause)

    /** A file of ours on the phone (`models.json`) we cannot read. */
    class Corrupt(val what: String, cause: Throwable? = null) : LmeException("corrupt $what", cause)

    /** The phone cannot serve local models at all; [reason] says why, fit for the UI. */
    class UnsupportedDevice(val reason: String) : LmeException("unsupported device: $reason")

    /** The model and its KV cache need more than our share of the phone's RAM. */
    class NotEnoughMemory(val needed: Long, val budget: Long) :
        LmeException("needs $needed bytes of RAM, the budget is $budget")

    /** The model server exited or never answered ready; [reason] says which. */
    class ServerNotReady(val reason: String) : LmeException("model server not ready: $reason")

    class Cancelled(cause: Throwable? = null) : LmeException("cancelled", cause)
}
