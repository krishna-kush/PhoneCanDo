package com.phonecando.lre.oci.http

import java.io.IOException
import java.net.URI

/**
 * Our redirect policy on top of a single-hop [HttpTransport]: up to five
 * hops, credential headers dropped for good once a hop leaves the current
 * origin (registry → blob CDN), `Range` and the rest kept, and no
 * https → http downgrade.
 */
internal object Redirects {
    private const val MAX_HOPS = 5
    private val REDIRECT_STATUSES = setOf(301, 302, 303, 307, 308)
    private val CREDENTIAL_HEADERS = setOf("authorization", "proxy-authorization", "cookie")

    /** GETs [url], following redirects. A broken redirect throws [IOException], like a transport. */
    fun get(transport: HttpTransport, url: String, headers: Map<String, String>): HttpResponse {
        var current = parse(url)
        var sent = headers
        repeat(MAX_HOPS + 1) {
            val response = transport.get(current.toString(), sent)
            if (response.status !in REDIRECT_STATUSES) return response
            val location = response.header("location")
            response.close()
            val next = resolve(current, location ?: throw IOException("redirect without a location"))
            if (current.scheme.equals("https", ignoreCase = true) && !next.scheme.equals("https", ignoreCase = true)) {
                throw IOException("redirect downgrades https to ${next.scheme}")
            }
            if (!sameOrigin(current, next)) sent = sent.filterKeys { it.lowercase() !in CREDENTIAL_HEADERS }
            current = next
        }
        throw IOException("too many redirects")
    }

    private fun parse(url: String): URI = try {
        URI(url)
    } catch (e: java.net.URISyntaxException) {
        throw IOException("bad url", e)
    }

    private fun resolve(base: URI, location: String): URI {
        val next = try {
            base.resolve(location.trim())
        } catch (e: IllegalArgumentException) {
            throw IOException("bad redirect location", e)
        }
        val scheme = next.scheme?.lowercase()
        if (scheme != "https" && scheme != "http") throw IOException("redirect to a non-http url")
        if (next.host.isNullOrEmpty()) throw IOException("redirect without a host")
        return next
    }

    private fun sameOrigin(a: URI, b: URI): Boolean =
        a.scheme.equals(b.scheme, ignoreCase = true) &&
            a.host.equals(b.host, ignoreCase = true) &&
            effectivePort(a) == effectivePort(b)

    private fun effectivePort(uri: URI): Int = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
