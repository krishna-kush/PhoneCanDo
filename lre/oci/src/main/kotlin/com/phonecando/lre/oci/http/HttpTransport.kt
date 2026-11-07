package com.phonecando.lre.oci.http

import java.io.Closeable
import java.io.IOException
import java.io.InputStream

/**
 * The one door to the network for the registry client and the Hub catalog,
 * so tests replay recorded responses through a fake.
 *
 * A transport sends exactly one GET and never follows redirects. We follow
 * them ourselves (blob downloads hop from the registry to a CDN) so the rule
 * that credentials never leave the registry's host lives in our code, the
 * same for every transport, and is covered by our tests.
 */
fun interface HttpTransport {
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
