package com.phonecando.lme.host.key

import java.security.SecureRandom

/** Per-boot API keys for a model server: 192 random bits as hex. */
object ApiKeys {
    private val SHAPE = Regex("[0-9a-f]{48}")

    fun newKey(random: SecureRandom = SecureRandom()): String =
        ByteArray(24).also(random::nextBytes).joinToString("") { "%02x".format(it) }

    fun isValid(key: String): Boolean = SHAPE.matches(key)
}
