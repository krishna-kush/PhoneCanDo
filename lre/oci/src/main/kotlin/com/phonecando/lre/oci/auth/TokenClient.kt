package com.phonecando.lre.oci.auth

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.lreNet
import com.phonecando.lre.oci.decodeOrCorrupt
import com.phonecando.network.http.HttpPort
import com.phonecando.network.http.errorFor
import com.phonecando.network.http.fetch
import com.phonecando.network.http.readCapped
import com.phonecando.network.http.redactUrl
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.net.URI
import java.net.URLEncoder

/** A pull token and how long the registry says it lives. */
internal class Token(val value: String, val ttlSeconds: Long) {
    /** Never print a token. */
    override fun toString(): String = "Token(<redacted>, ${ttlSeconds}s)"
}

/**
 * Fetches anonymous pull tokens from a challenge's realm (no credentials
 * sent). Called inside a registry request, so a failure to reach the realm
 * stays network's error, mapped with the request's.
 */
internal class TokenClient(private val port: HttpPort) {
    @Serializable
    private class TokenDoc(
        val token: String? = null,
        @SerialName("access_token") val accessToken: String? = null,
        @SerialName("expires_in") val expiresIn: Long? = null,
    )

    /**
     * Asks [challenge]'s realm for a token with the challenge's scope, or
     * [fallbackScope] (`repository:<repo>:pull`) when it names none.
     * [allowHttp] permits an http realm (local registries only).
     */
    fun fetch(challenge: BearerChallenge, fallbackScope: String, allowHttp: Boolean): Token {
        val realm = checkedRealm(challenge.realm, allowHttp)
        val query = buildList {
            challenge.service?.let { add("service=" + encode(it)) }
            add("scope=" + encode(challenge.scope ?: fallbackScope))
        }.joinToString("&")
        val url = realm + (if (realm.contains('?')) "&" else "?") + query
        val response = port.fetch(url, mapOf("Accept" to "application/json"))
        if (response.status != 200) {
            response.close()
            throw errorFor(response, url, "token service")
        }
        // Past the cap it is too large; only this call knows the cap.
        val body = lreNet("token response", TOKEN_LIMIT) { response.readCapped(TOKEN_LIMIT, url, "token response") }
        val doc = decodeOrCorrupt<TokenDoc>(body, "token response")
        val value = (doc.token ?: doc.accessToken)?.takeIf { it.isNotBlank() }
            ?: throw LreException.Corrupt("token response")
        if (value.any { it == '\r' || it == '\n' }) throw LreException.Corrupt("token response")
        return Token(value, doc.expiresIn ?: DEFAULT_TTL_SECONDS)
    }

    private fun checkedRealm(realm: String, allowHttp: Boolean): String {
        val scheme = try {
            URI(realm).scheme?.lowercase()
        } catch (e: java.net.URISyntaxException) {
            null
        }
        if (scheme == "https" || (allowHttp && scheme == "http")) return realm
        throw LreException.Network(redactUrl(realm), null, IllegalStateException("refusing a token realm over ${scheme ?: "nothing"}"))
    }

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private companion object {
        const val TOKEN_LIMIT = 256L * 1024
        /** The distribution spec's default when a token response names no lifetime. */
        const val DEFAULT_TTL_SECONDS = 60L
    }
}
