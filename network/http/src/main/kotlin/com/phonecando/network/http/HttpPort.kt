package com.phonecando.network.http

import java.io.Closeable
import java.io.IOException
import java.io.InputStream

/**
 * The one door to the network for every engine (lme's catalog, downloads and
 * health probe; lre's registries and Hub catalog), so tests replay recorded
 * responses through a fake.
 *
 * A port sends exactly one GET and never follows redirects. We follow them
 * ourselves ([Redirects]: Hugging Face downloads and registry blobs hop to a
 * CDN) so the rule that a credential never leaves the host it was meant for
 * lives in our code, the same for every port, and is covered by our tests.
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
 * (the error body for 4xx/5xx) and must be closed. [redirectedAway] is set by
 * [Redirects] (never by a port) when a redirect took us off the origin we
 * asked, so the answer is the CDN's, not the Hub's. [onAbort] is how a port
 * drops the connection from another thread (a pause while a read hangs).
 */
class HttpResponse(
    val status: Int,
    headers: Map<String, List<String>>,
    val body: InputStream,
    val redirectedAway: Boolean = false,
    private val onAbort: (() -> Unit)? = null,
) : Closeable {
    val headers: Map<String, List<String>> =
        headers.entries.groupBy({ it.key.lowercase() }, { it.value }).mapValues { it.value.flatten() }

    /** First value of header [name] (any case), or null. */
    fun header(name: String): String? = headers[name.lowercase()]?.firstOrNull()

    /** The same answer, marked as one from another origin (for [Redirects]). */
    internal fun redirected(): HttpResponse = HttpResponse(status, headers, body, redirectedAway = true, onAbort = onAbort)

    /** Drops the connection from any thread: a read blocked on it fails at once. Never throws. */
    fun abort() {
        try {
            (onAbort ?: ::close)()
        } catch (_: Exception) {
            // Already gone.
        }
    }

    override fun close() = body.close()
}
