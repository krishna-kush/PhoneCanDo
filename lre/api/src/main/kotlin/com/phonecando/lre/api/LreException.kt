package com.phonecando.lre.api

/** Every failure the runtime reports, typed so the UI can say what went wrong. */
sealed class LreException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /** A tar entry that would escape the root, or another unsafe shape. */
    class UnsafeEntry(val path: String, val reason: String) : LreException("unsafe entry $path: $reason")

    class TooLarge(val what: String, val limit: Long, val unit: String = "bytes") :
        LreException("$what exceeds $limit $unit")

    /** Not an image reference; [reason] says why, fit for the UI. */
    class InvalidRef(val input: String, val reason: String) : LreException("invalid image reference: $reason")

    class NoSpace(val needed: Long, val free: Long) : LreException("needs $needed bytes, $free free")

    class DigestMismatch(val expected: String, val actual: String) :
        LreException("digest mismatch: expected $expected, got $actual")

    class Network(val url: String, val status: Int?, cause: Throwable? = null) :
        LreException("network error on $url${status?.let { " (http $it)" } ?: ""}", cause)

    /** Registry pull limit hit and no mirror could serve the image. */
    class RateLimited(val url: String) : LreException("rate limited on $url")

    class NotFound(val what: String) : LreException("$what not found")

    /** The image has no linux/arm64 build. */
    class NoArm64(val image: String) : LreException("$image has no linux/arm64 build")

    class UnsupportedLayer(val mediaType: String) : LreException("unsupported layer type $mediaType")

    /** A manifest kind we can't read (Docker schema 1 and the like). */
    class UnsupportedManifest(val mediaType: String) : LreException("unsupported manifest type $mediaType")

    /** The unpacked base has no shell at all. */
    class NoShell : LreException("the image has no shell")

    class Corrupt(val what: String, cause: Throwable? = null) : LreException("corrupt $what", cause)

    class Cancelled : LreException("cancelled")
}
