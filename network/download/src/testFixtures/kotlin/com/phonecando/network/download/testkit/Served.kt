package com.phonecando.network.download.testkit

import com.phonecando.network.http.HttpResponse
import com.phonecando.network.testkit.Request
import com.phonecando.network.testkit.brokenReply
import com.phonecando.network.testkit.reply
import java.security.MessageDigest

/**
 * A file as a CDN serves it: 200 for the whole, 206 with `Content-Range`
 * for `Range: bytes=N-`, 416 past the end. [ignoreRange] answers 200
 * always; [breakAfter] cuts the body after that many bytes.
 */
class Served(val bytes: ByteArray, private val ignoreRange: Boolean = false, private val breakAfter: Int? = null) {
    val sha256: String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    fun answer(request: Request): HttpResponse {
        val start = request.header("range")?.let { Regex("bytes=(\\d+)-").find(it)!!.groupValues[1].toInt() }
        if (start == null || ignoreRange) return body(200, bytes, emptyMap())
        if (start >= bytes.size) return reply(416)
        return body(206, bytes.copyOfRange(start, bytes.size), mapOf("Content-Range" to "bytes $start-${bytes.size - 1}/${bytes.size}"))
    }

    private fun body(status: Int, payload: ByteArray, headers: Map<String, String>): HttpResponse =
        if (breakAfter != null && breakAfter < payload.size) {
            brokenReply(status, payload.copyOf(breakAfter), headers)
        } else {
            reply(status, payload, headers)
        }
}
