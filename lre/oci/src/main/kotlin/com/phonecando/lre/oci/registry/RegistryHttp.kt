package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.auth.BearerChallenge
import com.phonecando.lre.oci.auth.TokenCache
import com.phonecando.lre.oci.auth.TokenClient
import com.phonecando.lre.oci.http.HttpResponse
import com.phonecando.lre.oci.http.HttpTransport
import com.phonecando.lre.oci.http.errorFor
import com.phonecando.lre.oci.http.fetch
import com.phonecando.lre.oci.http.readCapped

/**
 * GETs against one registry source with the anonymous token flow: send
 * with the cached token (if any); on 401 read the Bearer challenge, fetch a
 * token once, retry once. A second 401 means the repository is missing or
 * private. Unaccepted statuses become typed errors.
 */
internal class RegistryHttp(
    private val transport: HttpTransport,
    private val tokens: TokenClient,
    private val cache: TokenCache,
) {
    /** A small response read whole (manifests, configs). */
    class Body(val bytes: ByteArray, val contentType: String?, val contentDigest: String?)

    /** [what] names the thing for a [LreException.NotFound], e.g. `image docker.io/library/alpine:latest`. */
    fun open(
        source: RegistrySource,
        path: String,
        headers: Map<String, String>,
        what: String,
        cancel: CancelSignal,
        accept: (Int) -> Boolean = { it in 200..299 },
    ): HttpResponse {
        if (cancel.isCancelled()) throw LreException.Cancelled()
        val url = source.url(path)
        var response = send(url, headers, cache.get(source.tokenKey))
        if (response.status == 401) {
            val challenge = BearerChallenge.parse(response.header("www-authenticate"))
            response.close()
            // No Bearer challenge: the registry wants a login we do not have.
            if (challenge == null) throw LreException.NotFound(what)
            cache.drop(source.tokenKey)
            val token = tokens.fetch(challenge, "repository:${source.repository}:pull", allowHttp = source.scheme == "http")
            cache.put(source.tokenKey, token.value, token.ttlSeconds)
            if (cancel.isCancelled()) throw LreException.Cancelled()
            response = send(url, headers, token.value)
            if (response.status == 401) {
                response.close()
                throw LreException.NotFound(what)
            }
        }
        if (accept(response.status)) return response
        response.close()
        throw errorFor(response.status, url, what)
    }

    /** [open] with a 2xx answer, body read whole up to [limit] bytes. */
    fun read(
        source: RegistrySource,
        path: String,
        headers: Map<String, String>,
        what: String,
        limit: Long,
        cancel: CancelSignal,
    ): Body {
        val response = open(source, path, headers, what, cancel)
        val bytes = response.readCapped(limit, source.url(path), what)
        return Body(bytes, response.header("content-type"), response.header("docker-content-digest"))
    }

    private fun send(url: String, headers: Map<String, String>, token: String?): HttpResponse {
        val sent = if (token == null) headers else headers + ("Authorization" to "Bearer $token")
        return transport.fetch(url, sent)
    }
}
