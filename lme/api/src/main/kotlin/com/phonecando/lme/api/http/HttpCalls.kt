package com.phonecando.lme.api.http

import com.phonecando.lme.api.LmeException
import java.io.ByteArrayOutputStream
import java.io.IOException

/** GETs [url] following redirects; getting no response at all becomes [LmeException.Network]. */
fun HttpPort.fetch(url: String, headers: Map<String, String>): HttpResponse = try {
    Redirects.get(this, url, headers)
} catch (e: IOException) {
    throw LmeException.Network(redactUrl(url), null, e)
}

/**
 * Reads the whole body, refusing more than [limit] bytes (bodies are
 * untrusted). A stream that breaks mid-way becomes [LmeException.Network].
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
            if (total > limit) throw LmeException.BadAnswer("$what: over $limit bytes")
            out.write(buffer, 0, n)
        }
    } catch (e: IOException) {
        throw LmeException.Network(redactUrl(url), null, e)
    }
    out.toByteArray()
}

/**
 * The typed error for a [response] to [url] we did not accept; [what] names the thing asked for.
 * A 401 or 403 from a host a redirect took us to (the CDN behind a Hugging Face download) says
 * nothing about access to [what]: it is a network error, and the next try gets a fresh signed URL.
 */
fun errorFor(response: HttpResponse, url: String, what: String): LmeException = when (response.status) {
    401, 403 -> if (response.redirectedAway) LmeException.Network(redactUrl(url), response.status) else LmeException.AccessDenied(what)
    404, 410 -> LmeException.NotFound(what)
    429 -> LmeException.RateLimited(redactUrl(url), retryAfterSeconds(response.header("retry-after")))
    else -> LmeException.Network(redactUrl(url), response.status)
}

/** `Retry-After` in seconds; null for none or an HTTP date (we then wait our own time). */
internal fun retryAfterSeconds(value: String?): Long? = value?.trim()?.toLongOrNull()?.takeIf { it >= 0 }
