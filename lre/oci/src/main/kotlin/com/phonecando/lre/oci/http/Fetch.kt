package com.phonecando.lre.oci.http

import com.phonecando.lre.api.LreException
import java.io.ByteArrayOutputStream
import java.io.IOException

/** GETs [url] following redirects; getting no response at all becomes [LreException.Network]. */
internal fun HttpTransport.fetch(url: String, headers: Map<String, String>): HttpResponse = try {
    Redirects.get(this, url, headers)
} catch (e: IOException) {
    throw LreException.Network(redactUrl(url), null, e)
}

/**
 * Reads the whole body, refusing more than [limit] bytes (bodies are
 * untrusted). A stream that breaks mid-way becomes [LreException.Network].
 */
internal fun HttpResponse.readCapped(limit: Long, url: String, what: String): ByteArray = use {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(16 * 1024)
    var total = 0L
    try {
        while (true) {
            val n = body.read(buffer)
            if (n < 0) break
            total += n
            if (total > limit) throw LreException.TooLarge(what, limit)
            out.write(buffer, 0, n)
        }
    } catch (e: IOException) {
        // A body that breaks mid-way is a dropped connection, worth a retry.
        throw LreException.Network(redactUrl(url), null, e)
    }
    out.toByteArray()
}

/** The typed error for an HTTP status we did not accept; [what] names the thing asked for. */
internal fun errorFor(status: Int, url: String, what: String): LreException = when (status) {
    404 -> LreException.NotFound(what)
    429 -> LreException.RateLimited(redactUrl(url))
    else -> LreException.Network(redactUrl(url), status)
}
