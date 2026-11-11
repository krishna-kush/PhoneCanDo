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

/** The typed error for an HTTP status we did not accept; [what] names the thing asked for. */
fun errorFor(status: Int, url: String, what: String): LmeException = when (status) {
    401, 403 -> LmeException.AccessDenied(what)
    404 -> LmeException.NotFound(what)
    429 -> LmeException.RateLimited(redactUrl(url))
    else -> LmeException.Network(redactUrl(url), status)
}
