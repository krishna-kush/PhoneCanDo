package com.phonecando.lre.cli.engine

/**
 * Reads `run/engine.env` the way the runner applies it (contract: lre/api's
 * ImageLayout): one `KEY=VALUE` per line, no quotes, no expansion, split at
 * the first `=`. Pure.
 */
object EngineEnvFile {
    /** The entries in file order; a later line for the same key wins. Lines without `=` are skipped. */
    fun parse(text: String): Map<String, String> {
        val env = LinkedHashMap<String, String>()
        text.lineSequence().filter { '=' in it }.forEach { line ->
            val key = line.substringBefore('=')
            if (key.isNotEmpty()) env[key] = line.substringAfter('=')
        }
        return env
    }

    /** The env as `export KEY='VALUE'` lines for a POSIX shell's `eval`. */
    fun exports(env: Map<String, String>): String =
        env.entries.joinToString("") { (key, value) -> "export $key=${singleQuote(value)}\n" }

    /** [value] in single quotes, each `'` written as `'\''`. */
    fun singleQuote(value: String): String = "'" + value.replace("'", "'\\''") + "'"
}
