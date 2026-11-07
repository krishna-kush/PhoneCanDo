package com.phonecando.lre.oci.http

import java.io.ByteArrayInputStream
import java.io.FilterInputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URISyntaxException
import java.net.URLConnection

/**
 * [HttpTransport] over [HttpURLConnection]: plain JDK, works the same on the
 * JVM and on Android (where the platform backs it with OkHttp).
 *
 * We ask for `Accept-Encoding: identity` so byte offsets in `Range` requests
 * are offsets in the stored blob and no layer decompresses transparently.
 */
class UrlConnectionTransport(
    private val connectTimeoutMillis: Int = 15_000,
    private val readTimeoutMillis: Int = 30_000,
    private val userAgent: String = "phonecando-lre",
) : HttpTransport {
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
        return HttpResponse(status, responseHeaders, body)
    }

    private fun open(url: String): URLConnection = try {
        URI(url).toURL().openConnection()
    } catch (e: IllegalArgumentException) {
        throw IOException("bad url", e)
    } catch (e: URISyntaxException) {
        throw IOException("bad url", e)
    }
}
