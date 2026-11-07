package com.phonecando.lre.oci.testkit

import com.phonecando.lre.oci.http.HttpResponse
import com.phonecando.lre.oci.http.HttpTransport
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream

/** One request the fake saw. */
data class Request(val url: String, val headers: Map<String, String>) {
    fun header(name: String): String? = headers.entries.firstOrNull { it.key.equals(name, ignoreCase = true) }?.value
}

/**
 * A scripted [HttpTransport]: exact-URL routes answer in order (the last
 * answer repeats), prefix routes answer whatever starts with them, anything
 * else is a 404. Every request is recorded.
 */
class FakeTransport : HttpTransport {
    val requests = mutableListOf<Request>()
    private val exact = HashMap<String, ArrayDeque<(Request) -> HttpResponse>>()
    private val prefixes = mutableListOf<Pair<String, (Request) -> HttpResponse>>()

    fun on(url: String, vararg replies: (Request) -> HttpResponse) {
        exact[url] = ArrayDeque(replies.toList())
    }

    fun onPrefix(prefix: String, reply: (Request) -> HttpResponse) {
        prefixes += prefix to reply
        prefixes.sortByDescending { it.first.length }
    }

    fun requestsTo(prefix: String): List<Request> = requests.filter { it.url.startsWith(prefix) }

    override fun get(url: String, headers: Map<String, String>): HttpResponse {
        val request = Request(url, headers)
        requests += request
        exact[url]?.let { queue ->
            val reply = if (queue.size > 1) queue.removeFirst() else queue.first()
            return reply(request)
        }
        prefixes.firstOrNull { url.startsWith(it.first) }?.let { return it.second(request) }
        return reply(404, """{"errors":[{"code":"NOT_FOUND"}]}""")
    }
}

fun reply(status: Int, body: ByteArray = ByteArray(0), headers: Map<String, String> = emptyMap()): HttpResponse =
    HttpResponse(status, headers.mapValues { listOf(it.value) }, ByteArrayInputStream(body))

fun reply(status: Int, body: String, headers: Map<String, String> = emptyMap()): HttpResponse =
    reply(status, body.toByteArray(), headers)

/** A response whose body breaks after [bytes]. */
fun brokenReply(status: Int, bytes: ByteArray, headers: Map<String, String> = emptyMap()): HttpResponse {
    val body = object : InputStream() {
        private var position = 0

        override fun read(): Int {
            if (position < bytes.size) return bytes[position++].toInt() and 0xff
            throw IOException("connection reset")
        }
    }
    return HttpResponse(status, headers.mapValues { listOf(it.value) }, body)
}

/** A transport-level failure: no response at all. */
fun noResponse(): HttpResponse = throw IOException("connect timed out")
