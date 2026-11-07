package com.phonecando.lre.cli.host

/** The host's DNS servers from resolv.conf text, as the phone reports its network's. Pure. */
object ResolvConf {
    /** Every `nameserver <addr>` value in order; comments, options and other lines are skipped. */
    fun nameservers(text: String): List<String> = text.lineSequence()
        .map { it.substringBefore('#').substringBefore(';').trim() }
        .mapNotNull { line ->
            val words = line.split(Regex("\\s+"))
            words.getOrNull(1)?.takeIf { words[0] == "nameserver" }
        }
        .toList()
}
