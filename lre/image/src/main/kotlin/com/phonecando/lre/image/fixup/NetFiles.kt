package com.phonecando.lre.image.fixup

/** Contents of the guest's network identity files. Pure. */
internal object NetFiles {
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

    /** [hostname] resolves to loopback, so sudo and friends find it. */
    fun hosts(hostname: String): String =
        "127.0.0.1 localhost $hostname\n" +
            "::1 localhost ip6-localhost ip6-loopback $hostname\n"

    fun hostname(hostname: String): String = "$hostname\n"
}
