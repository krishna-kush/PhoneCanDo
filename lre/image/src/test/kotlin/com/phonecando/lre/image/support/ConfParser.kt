package com.phonecando.lre.image.support

/**
 * A test-side launch.conf reader that follows lre/launcher/src/conf.h and
 * plan.c line by line, so a format slip in our writer fails here rather than
 * as "phonecando-launch: ..." on a phone.
 */
data class ParsedConf(val entries: List<Pair<String, String>>) {
    val args get() = values("arg")
    val sets get() = values("set")
    val unsets get() = values("unset")
    val maps get() = values("map").map { it.substringBefore(' ') to it.substringAfter(' ') }
    val same get() = values("same")
    val home get() = values("home").lastOrNull() ?: "/"

    private fun values(keyword: String) = entries.filter { it.first == keyword }.map { it.second }

    /** plan.c lc_command: our own lib*.so name means bash, then `map` (the later line wins). */
    fun command(argv0: String): String {
        var name = argv0.substringAfterLast('/')
        if (name.length >= 6 && name.startsWith("lib") && name.endsWith(".so")) name = "bash"
        return maps.lastOrNull { it.first == name }?.second ?: name
    }

    /** plan.c lc_cwd: the cwd when at or under a `same` path, else `home`. */
    fun cwd(cwd: String): String =
        if (cwd.startsWith("/") && same.any { under(cwd, it) }) cwd else home

    /** plan.c lc_env: inherited minus what unset and set replace, then every set (the later one wins). */
    fun env(inherited: Map<String, String>): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        val setKeys = sets.map { it.substringBefore('=') }.toSet()
        for ((key, value) in inherited) {
            val dropped = key in setKeys || unsets.any { u -> if (u.endsWith("*")) key.startsWith(u.dropLast(1)) else key == u }
            if (!dropped) out[key] = value
        }
        sets.forEach { out[it.substringBefore('=')] = it.substringAfter('=') }
        return out
    }

    private fun under(cwd: String, root: String): Boolean {
        val r = root.trimEnd('/').ifEmpty { return true }
        return cwd == r || cwd.startsWith("$r/")
    }
}

object ConfParser {
    private const val MAX_BYTES = 256 * 1024
    private const val MAX_LINES = 4096
    private val KEYWORDS = setOf("arg", "set", "unset", "map", "same", "home")

    fun parse(text: String): ParsedConf {
        val bytes = text.toByteArray(Charsets.UTF_8)
        require(bytes.size <= MAX_BYTES) { "over 256 KiB" }
        require('\u0000' !in text) { "contains a NUL byte" }
        val lines = text.split('\n').let { if (text.endsWith("\n")) it.dropLast(1) else it }
        require(lines.size <= MAX_LINES) { "over 4096 lines" }
        val entries = ArrayList<Pair<String, String>>()
        lines.forEachIndexed { i, line ->
            val no = i + 1
            if (line.isEmpty() || line.startsWith("#")) return@forEachIndexed
            val space = line.indexOf(' ')
            val keyword = if (space < 0) line else line.substring(0, space)
            require(keyword in KEYWORDS) { "line $no: unknown keyword" }
            require(space >= 0) { "line $no: missing value" }
            val value = line.substring(space + 1)
            when (keyword) {
                "arg" -> if (entries.none { it.first == "arg" }) {
                    require(value.startsWith("/")) { "line $no: the first arg must be the absolute path of proot" }
                }
                "set" -> require(value.indexOf('=') > 0) { "line $no: set needs KEY=VALUE" }
                "unset" -> {
                    require(value.isNotEmpty() && '=' !in value) { "line $no: unset needs a NAME" }
                    val star = value.indexOf('*')
                    require(star < 0 || star == value.length - 1) { "line $no: unset allows '*' only at the end" }
                }
                "map" -> {
                    val sep = value.indexOf(' ')
                    require(sep > 0 && sep < value.length - 1 && ' ' !in value.substring(sep + 1)) {
                        "line $no: map needs NAME GUEST"
                    }
                }
                "same" -> require(value.startsWith("/")) { "line $no: same needs an absolute path" }
                "home" -> require(value.startsWith("/")) { "line $no: home needs an absolute path" }
            }
            entries += keyword to value
        }
        require(entries.any { it.first == "arg" }) { "no arg line" }
        return ParsedConf(entries)
    }
}
