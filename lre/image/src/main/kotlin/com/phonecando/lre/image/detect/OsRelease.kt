package com.phonecando.lre.image.detect

/**
 * Parses os-release(5): `KEY=VALUE` lines, `#` comments, values bare or in
 * single or double quotes, with shell-style backslash escapes. Pure.
 */
internal object OsRelease {
    private val KEY = Regex("[A-Za-z0-9_]+")

    fun parse(text: String): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        for (raw in text.lineSequence()) {
            val line = raw.trim()
            if (line.isEmpty() || line.startsWith("#")) continue
            val eq = line.indexOf('=')
            if (eq <= 0) continue
            val key = line.substring(0, eq)
            if (!KEY.matches(key)) continue
            out[key] = unquote(line.substring(eq + 1).trim())
        }
        return out
    }

    private fun unquote(value: String): String {
        val quote = value.firstOrNull()?.takeIf { it == '"' || it == '\'' }
        val body = StringBuilder()
        var i = if (quote != null) 1 else 0
        while (i < value.length) {
            val c = value[i]
            when {
                c == quote -> return body.toString()
                c == '\\' && quote != '\'' && i + 1 < value.length -> {
                    body.append(value[i + 1])
                    i++
                }
                else -> body.append(c)
            }
            i++
        }
        return body.toString()
    }
}
