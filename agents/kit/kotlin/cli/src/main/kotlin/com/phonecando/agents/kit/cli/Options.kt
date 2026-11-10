package com.phonecando.agents.kit.cli

// One command's options: `--name value` for its valued names, a bare
// `--name` for its flags. Anything else, or a valued name without a value,
// is bad usage: IllegalArgumentException, which Cli turns into exit 2.
class Options private constructor(private val values: Map<String, String>, private val flags: Set<String>) {
  fun opt(name: String): String? = values[name]

  fun required(name: String): String = values[name] ?: throw IllegalArgumentException("$name is required")

  fun flag(name: String): Boolean = name in flags

  companion object {
    fun parse(args: List<String>, valued: Set<String>, flags: Set<String> = emptySet()): Options {
      val values = mutableMapOf<String, String>()
      val set = mutableSetOf<String>()
      var i = 0
      while (i < args.size) {
        val name = args[i]
        when (name) {
          in flags -> set += name
          in valued -> values[name] = args.getOrNull(i + 1)?.takeUnless { it.startsWith("--") }
            ?: throw IllegalArgumentException("$name needs a value")
          else -> throw IllegalArgumentException("unknown option $name")
        }
        i += if (name in valued) 2 else 1
      }
      return Options(values, set)
    }
  }
}
