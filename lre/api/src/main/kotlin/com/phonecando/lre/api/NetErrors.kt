package com.phonecando.lre.api

import com.phonecando.network.NetException

/**
 * A failure of our network code as lre's own, with the original kept as its
 * cause so the shared retry rules still see it. lre has no AccessDenied: a
 * registry's 401 is its token flow, and a 403 is a network error the next
 * mirror may not give. An answer past a body's cap is too large when the
 * call names [what] and [limit] (readCapped), else corrupt.
 */
fun NetException.toLre(what: String? = null, limit: Long? = null): LreException = when (this) {
    is NetException.Network -> LreException.Network(url, status, this)
    is NetException.RateLimited -> LreException.RateLimited(url, retryAfterSeconds, this)
    is NetException.NotFound -> LreException.NotFound(this.what, this)
    is NetException.AccessDenied -> LreException.Network(url, status, this)
    is NetException.BadAnswer ->
        if (limit != null) LreException.TooLarge(what ?: this.what, limit, cause = this) else LreException.Corrupt(this.what, this)
    is NetException.SizeMismatch -> LreException.TooLarge(this.what, expected, cause = this)
    is NetException.DigestMismatch -> LreException.DigestMismatch("$SHA256$expected", "$SHA256$actual", this)
    is NetException.Cancelled -> LreException.Cancelled(this)
}

/** Runs [block] with a network failure turned into lre's own ([toLre]): wraps every call into network code. */
inline fun <T> lreNet(what: String? = null, limit: Long? = null, block: () -> T): T = try {
    block()
} catch (e: NetException) {
    throw e.toLre(what, limit)
}

private const val SHA256 = "sha256:"
