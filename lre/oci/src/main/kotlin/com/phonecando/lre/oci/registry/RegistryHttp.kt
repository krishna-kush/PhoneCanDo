package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.lreNet
import com.phonecando.lre.oci.auth.BearerChallenge
import com.phonecando.lre.oci.auth.TokenCache
import com.phonecando.lre.oci.auth.TokenClient
import com.phonecando.network.CancelSignal
import com.phonecando.network.NetException
import com.phonecando.network.download.RangeOpener
import com.phonecando.network.http.HttpPort
import com.phonecando.network.http.HttpResponse
import com.phonecando.network.http.errorFor
import com.phonecando.network.http.fetch
import com.phonecando.network.http.readCapped
import com.phonecando.network.http.redactUrl

/**
 * GETs against one registry source with the anonymous token flow: send
 * with the cached token (if any); on 401 read the Bearer challenge, fetch a
 * token once, retry once. A second 401 means the repository is missing or
 * private. Unaccepted statuses become typed errors.
 */
internal class RegistryHttp(
    private val port: HttpPort,
    private val tokens: TokenClient,
    private val cache: TokenCache,
) {
    /** A small response read whole (manifests, configs). */
    class Body(val bytes: ByteArray, val contentType: String?, val contentDigest: String?)

    /**
     * [what] names the thing for a not found, e.g. `image docker.io/library/alpine:latest`.
     * Throws network's errors (NetException), so a blob download keeps its hash checkpoint
     * across a dropped connection; the caller maps them ([lreNet]).
     */
    fun open(
        source: RegistrySource,
        path: String,
        headers: Map<String, String>,
        what: String,
        cancel: CancelSignal,
        accept: (Int) -> Boolean = { it in 200..299 },
    ): HttpResponse {
        if (cancel.isCancelled()) throw NetException.Cancelled()
        val url = source.url(path)
        var response = send(url, headers, cache.get(source.tokenKey))
        // A 401 from the CDN a redirect took us to is not the registry asking for a token.
        if (response.status == 401 && !response.redirectedAway) {
            val challenge = BearerChallenge.parse(response.header("www-authenticate"))
            response.close()
            // No Bearer challenge: the registry wants a login we do not have.
            if (challenge == null) throw NetException.NotFound(what)
            cache.drop(source.tokenKey)
            val token = tokens.fetch(challenge, "repository:${source.repository}:pull", allowHttp = source.scheme == "http")
            cache.put(source.tokenKey, token.value, token.ttlSeconds)
            if (cancel.isCancelled()) throw NetException.Cancelled()
            response = send(url, headers, token.value)
            if (response.status == 401 && !response.redirectedAway) {
                response.close()
                throw NetException.NotFound(what)
            }
        }
        if (accept(response.status)) return response
        response.close()
        throw errorFor(response, url, what)
    }

    /** [open] with a 2xx answer, body read whole up to [limit] bytes; failures are lre's. */
    fun read(
        source: RegistrySource,
        path: String,
        headers: Map<String, String>,
        what: String,
        limit: Long,
        cancel: CancelSignal,
    ): Body = lreNet(what, limit) {
        val response = open(source, path, headers, what, cancel)
        val bytes = response.readCapped(limit, source.url(path), what)
        Body(bytes, response.header("content-type"), response.header("docker-content-digest"))
    }

    /** A blob at [path] for network's FileDownloader: `Range` from an offset, 200, 206 and 416 come back. */
    fun opener(source: RegistrySource, path: String, what: String, cancel: CancelSignal): RangeOpener = object : RangeOpener {
        override val where = redactUrl(source.url(path))

        override fun open(offset: Long): HttpResponse {
            val range = if (offset > 0) mapOf("Range" to "bytes=$offset-") else emptyMap()
            return this@RegistryHttp.open(source, path, range, what, cancel) { it == 200 || it == 206 || it == 416 }
        }
    }

    private fun send(url: String, headers: Map<String, String>, token: String?): HttpResponse {
        val sent = if (token == null) headers else headers + ("Authorization" to "Bearer $token")
        return port.fetch(url, sent)
    }
}
