package com.phonecando.lme.api

/**
 * Every failure the engine reports, typed so the UI can say what went wrong.
 * A message names the thing, never a secret: URLs go through [com.phonecando.lme.api.http.redactUrl]
 * first, and a token or API key never reaches one.
 */
sealed class LmeException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /** Not a GGUF file we can serve; [reason] says why, fit for the UI. */
    class InvalidGguf(val reason: String) : LmeException("not a usable GGUF file: $reason")

    class TooLarge(val what: String, val limit: Long) : LmeException("$what exceeds $limit")

    /** Not a model id or repository name; [reason] says why, fit for the UI. */
    class InvalidName(val input: String, val reason: String) : LmeException("invalid name: $reason")

    /** The same model (same source, same files) is already on the phone as [id]. */
    class Exists(val id: String) : LmeException("already on the phone as $id")

    class NoSpace(val needed: Long, val free: Long) : LmeException("needs $needed bytes, $free free")

    class SizeMismatch(val what: String, val expected: Long, val actual: Long) :
        LmeException("$what is $actual bytes, expected $expected")

    class DigestMismatch(val what: String, val expected: String, val actual: String) :
        LmeException("$what: sha256 mismatch, expected $expected, got $actual")

    class Network(val url: String, val status: Int?, cause: Throwable? = null) :
        LmeException("network error on $url${status?.let { " (http $it)" } ?: ""}", cause)

    class RateLimited(val url: String) : LmeException("rate limited on $url")

    class NotFound(val what: String) : LmeException("$what not found")

    /**
     * HTTP 401 or 403: a gated or private repository, or a token without
     * access to it. Hugging Face also answers 401 for a repository that does
     * not exist when no token is sent.
     */
    class AccessDenied(val what: String) : LmeException("no access to $what")

    class Corrupt(val what: String, cause: Throwable? = null) : LmeException("corrupt $what", cause)

    /** The phone cannot serve local models at all; [reason] says why, fit for the UI. */
    class UnsupportedDevice(val reason: String) : LmeException("unsupported device: $reason")

    /** The model and its KV cache need more than our share of the phone's RAM. */
    class NotEnoughMemory(val needed: Long, val budget: Long) :
        LmeException("needs $needed bytes of RAM, the budget is $budget")

    /** The model server exited or never answered ready; [reason] says which. */
    class ServerNotReady(val reason: String) : LmeException("model server not ready: $reason")

    class Cancelled : LmeException("cancelled")
}
