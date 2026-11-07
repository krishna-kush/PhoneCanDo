package com.phonecando.lre.image.fixup

/** Contents of the guest's network identity files. Pure. */
internal object NetFiles {
    const val HOSTNAME = "phonecando"

    /** Used when the phone reports no DNS server we can write. */
    val FALLBACK_DNS = listOf("1.1.1.1", "8.8.8.8")

    /** glibc reads at most three nameserver lines (MAXNS). */
    private const val MAX_SERVERS = 3
    private val ADDRESS = Regex("[0-9A-Fa-f.:]+(%[A-Za-z0-9_.-]+)?")

    fun resolvConf(dnsServers: List<String>): String {
        val servers = dnsServers.map { it.trim() }.filter { ADDRESS.matches(it) && it.any(Char::isDigit) }
            .distinct().take(MAX_SERVERS).ifEmpty { FALLBACK_DNS }
        return servers.joinToString("") { "nameserver $it\n" }
    }

    fun hosts(): String =
        "127.0.0.1 localhost $HOSTNAME\n" +
            "::1 localhost ip6-localhost ip6-loopback $HOSTNAME\n"

    fun hostname(): String = "$HOSTNAME\n"
}
