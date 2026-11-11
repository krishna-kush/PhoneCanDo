package com.phonecando.lme.api.http

import java.io.ByteArrayInputStream
import java.io.FilterInputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URISyntaxException
import java.net.URLConnection

/**
 * [HttpPort] over [HttpURLConnection]: plain JDK, works the same on the JVM
 * and on Android (where the platform backs it with OkHttp).
 *
 * We ask for `Accept-Encoding: identity` so byte offsets in `Range` requests
 * are offsets in the stored file and no layer decompresses transparently.
 */
class UrlConnectionPort(
    private val connectTimeoutMillis: Int = 15_000,
    private val readTimeoutMillis: Int = 30_000,
    private val userAgent: String = "phonecando-lme",
) : HttpPort {
    override fun get(url: String, headers: Map<String, String>): HttpResponse {
        val connection = open(url) as? HttpURLConnection ?: throw IOException("not an http url")

        connection.instanceFollowRedirects = false
        connection.connectTimeout = connectTimeoutMillis
        connection.readTimeout = readTimeoutMillis
        connection.useCaches = false
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", userAgent)
        connection.setRequestProperty("Accept-Encoding", "identity")
        headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }

        val status = try {
            connection.responseCode
        } catch (e: IOException) {
            connection.disconnect()
            throw e
        }
        val stream = try {
            if (status >= 400) connection.errorStream else connection.inputStream
        } catch (e: IOException) {
            null
        } ?: ByteArrayInputStream(ByteArray(0))
        val responseHeaders = connection.headerFields
            .filterKeys { it != null }
            .mapKeys { it.key!! }
        val body = object : FilterInputStream(stream) {
            override fun close() {
                try {
                    super.close()
                } finally {
                    connection.disconnect()
                }
            }
        }
        // disconnect() from another thread closes the socket under a blocked read (JDK and Android's OkHttp).
        return HttpResponse(status, responseHeaders, body, onAbort = connection::disconnect)
    }

    private fun open(url: String): URLConnection = try {
        URI(url).toURL().openConnection()
    } catch (e: IllegalArgumentException) {
        throw IOException("bad url", e)
    } catch (e: URISyntaxException) {
        throw IOException("bad url", e)
    }
}
