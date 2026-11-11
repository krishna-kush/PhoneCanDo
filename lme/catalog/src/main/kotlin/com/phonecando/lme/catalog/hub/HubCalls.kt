package com.phonecando.lme.catalog.hub

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.api.http.HttpResponse
import com.phonecando.lme.api.http.errorFor
import com.phonecando.lme.api.http.fetch
import com.phonecando.lme.api.http.readCapped
import com.phonecando.lme.catalog.HubCallsLeft
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * GETs on the Hub's JSON API with the user's token, if any. The token goes
 * only to [HubUrls.HUB] URLs (and [com.phonecando.lme.api.http.Redirects]
 * drops it on a hop elsewhere); it never reaches a message or a log. Every
 * answer, a refusal's too, tells [callsLeft] what the Hub has left.
 */
internal class HubCalls(private val http: HttpPort, private val token: String?, private val callsLeft: HubCallsLeft) {
    /** The decoded body and the response's next-page link, if any. */
    fun <T> get(url: String, what: String, cancel: CancelSignal, decode: (String) -> T): Pair<T, String?> {
        check(HubUrls.isHub(url)) { "not a Hub url" }
        if (cancel.isCancelled()) throw LmeException.Cancelled()
        val headers = buildMap {
            put("Accept", "application/json")
            token?.takeIf { it.isNotBlank() }?.let { put("Authorization", "Bearer $it") }
        }
        val response: HttpResponse = http.fetch(url, headers)
        callsLeft.note(response.header("ratelimit"))
        if (response.status != 200) {
            response.close()
            throw errorFor(response, url, what)
        }
        val next = Links.next(response.header("link"))
        val text = response.readCapped(BODY_LIMIT, url, what).decodeToString()
        val value = try {
            decode(text)
        } catch (e: SerializationException) {
            throw LmeException.BadAnswer(what, e)
        } catch (e: IllegalArgumentException) {
            throw LmeException.BadAnswer(what, e)
        }
        return value to next
    }

    companion object {
        val JSON = Json { ignoreUnknownKeys = true }
        private const val BODY_LIMIT = 8L * 1024 * 1024
    }
}
