package com.phonecando.lme.api

import com.phonecando.network.NetException

/**
 * A failure of our network code as lme's own (the app reads those), with
 * the original kept as its cause so the shared retry rules still see it.
 */
fun NetException.toLme(): LmeException = when (this) {
    is NetException.Network -> LmeException.Network(url, status, this)
    is NetException.RateLimited -> LmeException.RateLimited(url, retryAfterSeconds, this)
    is NetException.NotFound -> LmeException.NotFound(what, this)
    is NetException.AccessDenied -> LmeException.AccessDenied(what, this)
    is NetException.BadAnswer -> LmeException.BadAnswer(what, this)
    is NetException.SizeMismatch -> LmeException.SizeMismatch(what, expected, actual, this)
    is NetException.DigestMismatch -> LmeException.DigestMismatch(what, expected, actual, this)
    is NetException.Cancelled -> LmeException.Cancelled(this)
}

/** Runs [block] with a network failure turned into lme's own: wraps every call into network code. */
inline fun <T> lmeNet(block: () -> T): T = try {
    block()
} catch (e: NetException) {
    throw e.toLme()
}
