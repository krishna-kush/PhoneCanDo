package com.phonecando.lre.cli.args

/** Which `--name` options one subcommand takes. */
internal data class OptionSpec(
    /** Options given at most once. */
    val single: Set<String>,
    /** Options that may repeat, values kept in order. */
    val multi: Set<String> = emptySet(),
    /** Whether `--` may end the options, the remaining words being the command. */
    val takesRest: Boolean = false,
)

/** Options as given; [rest] is null when no `--` came. */
internal data class ParsedOptions(
    val single: Map<String, String>,
    val multi: Map<String, List<String>>,
    val rest: List<String>?,
) {
    fun required(name: String): String = single[name] ?: throw UsageError("--$name is required")

    fun all(name: String): List<String> = multi[name].orEmpty()
}

/** Reads `--name value` and `--name=value` options against an [OptionSpec]. Pure. */
internal object Options {
    fun read(command: String, args: List<String>, spec: OptionSpec): ParsedOptions {
        val single = LinkedHashMap<String, String>()
        val multi = LinkedHashMap<String, MutableList<String>>()
        var i = 0
        while (i < args.size) {
            val word = args[i++]
            if (word == "--") {
                if (!spec.takesRest) throw UsageError("$command takes no command after --")
                return ParsedOptions(single, multi, args.subList(i, args.size).toList())
            }
            if (!word.startsWith("--") || word.length == 2) throw UsageError("unexpected argument '$word'")
            val body = word.removePrefix("--")
            val name = body.substringBefore('=')
            val value = if ('=' in body) {
                body.substringAfter('=')
            } else {
                args.getOrNull(i)?.takeUnless { it.startsWith("--") }?.also { i++ }
                    ?: throw UsageError("--$name needs a value")
            }
            if (value.isEmpty()) throw UsageError("--$name needs a value")
            when (name) {
                in spec.single -> if (single.put(name, value) != null) throw UsageError("--$name given twice")
                in spec.multi -> multi.getOrPut(name) { mutableListOf() } += value
                else -> throw UsageError("unknown option --$name for $command")
            }
        }
        return ParsedOptions(single, multi, null)
    }
}
