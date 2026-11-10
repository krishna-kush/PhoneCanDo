package com.phonecando.lme.api.http

import java.io.Closeable
import java.io.IOException
import java.io.InputStream

/**
 * The one door to the network for the catalog, the store's downloads and the
 * server health probe, so tests replay recorded responses through a fake.
 *
 * A port sends exactly one GET and never follows redirects. We follow them
 * ourselves ([Redirects]: Hugging Face downloads hop to a CDN) so the rule
 * that a token never leaves the host it was meant for lives in our code, the
 * same for every port, and is covered by our tests.
 */
fun interface HttpPort {
    /**
     * Sends one GET to [url] with [headers] (`Accept`, `Range`,
     * `Authorization`, ...). A 3xx comes back as is, with its `Location`
     * header. The caller closes the response.
     *
     * @throws IOException when no response arrives (DNS, connect, TLS, timeout).
     */
    @Throws(IOException::class)
    fun get(url: String, headers: Map<String, String>): HttpResponse
}

/**
 * One HTTP response. Header names are lower-cased; [body] streams the payload
 * (the error body for 4xx/5xx) and must be closed.
 */
class HttpResponse(
    val status: Int,
    headers: Map<String, List<String>>,
    val body: InputStream,
) : Closeable {
    val headers: Map<String, List<String>> =
        headers.entries.groupBy({ it.key.lowercase() }, { it.value }).mapValues { it.value.flatten() }

    /** First value of header [name] (any case), or null. */
    fun header(name: String): String? = headers[name.lowercase()]?.firstOrNull()

    override fun close() = body.close()
}
