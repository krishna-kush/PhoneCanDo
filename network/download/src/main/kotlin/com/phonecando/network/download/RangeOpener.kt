package com.phonecando.network.download

import com.phonecando.network.http.HttpPort
import com.phonecando.network.http.HttpResponse
import com.phonecando.network.http.errorFor
import com.phonecando.network.http.fetch
import com.phonecando.network.http.redactUrl

/** What a download must turn out to be: [name] in errors, [sizeBytes] and lower-case hex [sha256]. */
data class ExpectedFile(val name: String, val sizeBytes: Long, val sha256: String)

/**
 * Where a file comes from. [where] (a redacted URL) names it in errors;
 * [open] asks from a byte offset. An engine with its own way in (a registry's
 * token flow) brings its own; a plain URL uses [of].
 */
interface RangeOpener {
    val where: String

    /** GETs the file from [offset] (0: all of it, else `Range: bytes=<offset>-`); returns only 2xx and 416, throws the rest typed. */
    fun open(offset: Long): HttpResponse

    companion object {
        /** [url] through [http] with [headers]; [what] names it in a status error. */
        fun of(http: HttpPort, url: String, headers: Map<String, String>, what: String): RangeOpener = object : RangeOpener {
            override val where = redactUrl(url)

            override fun open(offset: Long): HttpResponse {
                val sent = if (offset > 0) headers + ("Range" to "bytes=$offset-") else headers
                val response = http.fetch(url, sent)
                if (response.status in 200..299 || response.status == 416) return response
                response.close()
                throw errorFor(response, url, what)
            }
        }
    }
}
