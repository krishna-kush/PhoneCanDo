package com.phonecando.network.http

import com.phonecando.network.NetException
import java.io.ByteArrayOutputStream
import java.io.IOException

/** GETs [url] following redirects; getting no response at all becomes [NetException.Network]. */
fun HttpPort.fetch(url: String, headers: Map<String, String>): HttpResponse = try {
    Redirects.get(this, url, headers)
} catch (e: IOException) {
    throw NetException.Network(redactUrl(url), null, e)
}

/**
 * Reads the whole body, refusing more than [limit] bytes (bodies are
 * untrusted). A stream that breaks mid-way becomes [NetException.Network].
 */
fun HttpResponse.readCapped(limit: Long, url: String, what: String): ByteArray = use {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(16 * 1024)
    var total = 0L
    try {
        while (true) {
            val n = body.read(buffer)
            if (n < 0) break
            total += n
            if (total > limit) throw NetException.BadAnswer("$what: over $limit bytes")
            out.write(buffer, 0, n)
        }
    } catch (e: IOException) {
        throw NetException.Network(redactUrl(url), null, e)
    }
    out.toByteArray()
}

/**
 * The typed error for a [response] to [url] we did not accept; [what] names the thing asked for.
 * A 401 or 403 from a host a redirect took us to (the CDN behind a download) says nothing about
 * access to [what]: it is a network error, and the next try gets a fresh signed URL. A 429 waits
 * as long as the server asks: the reset of its used-up `RateLimit` policy, else `Retry-After`.
 */
fun errorFor(response: HttpResponse, url: String, what: String): NetException = when (response.status) {
    401, 403 ->
        if (response.redirectedAway) {
            NetException.Network(redactUrl(url), response.status)
        } else {
            NetException.AccessDenied(what, redactUrl(url), response.status)
        }
    404, 410 -> NetException.NotFound(what)
    429 -> NetException.RateLimited(redactUrl(url), retryAfterSeconds(response))
    else -> NetException.Network(redactUrl(url), response.status)
}

/** How long a 429 asks us to wait, in seconds; null when it does not say (an HTTP date counts as not saying). */
internal fun retryAfterSeconds(response: HttpResponse): Long? =
    RateLimitHeader.exhausted(response.header("ratelimit"))
        ?: response.header("retry-after")?.trim()?.toLongOrNull()?.takeIf { it >= 0 }
