package com.phonecando.lme.host.health

import com.phonecando.network.http.HttpPort
import java.io.IOException

/**
 * One GET of a model server's health URL on loopback. `/health` needs no
 * key, so none is sent; redirects are not followed (a loopback server has
 * no business sending one).
 */
class HealthProbe(private val http: HttpPort) {
    fun probe(url: String): Health = try {
        http.get(url, mapOf("Accept" to "application/json")).use { Health.of(it.status) }
    } catch (_: IOException) {
        Health.Starting
    }
}
