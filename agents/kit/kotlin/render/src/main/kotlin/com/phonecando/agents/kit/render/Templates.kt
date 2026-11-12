package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ArgvItem

// The manifest's templates: `{{name}}` is a placeholder, filled from the
// values a caller has at that moment (a launch knows the port, the TUI client
// also the project). An unknown name, or a known one this caller has no value
// for, throws KindException. `${…}` and every other text pass through
// untouched, so a vendor's own env expansion still works. An argv item
// {"when": "<name>", "args": [...]} adds its args only when that
// placeholder's value is non-empty.
object Templates {
  /** Every placeholder a manifest may use. */
  val KNOWN = setOf(
    "libDir", "home", "tmp", "port", "serverUrl", "bridgeUrl", "password", "projectDir", "sessionId", "code",
    // A local model's (ModelSeam), in a kind's `models` block only.
    "baseUrl", "model", "contextWindow", "modelKey",
    // The agent's own state folder (StateSeam), in a kind's `state.env` only.
    "stateDir",
    // Other agents' messages, rendered (InboxSeam), in a kind's `inbox` only.
    "messages",
  )

  private val PLACEHOLDER = Regex("""\{\{([^{}]*)\}\}""")

  /** [template] filled from [values]; [escape] turns each value into its form in this text (a URL path component). */
  fun render(template: String, values: Map<String, String>, escape: (String) -> String = { it }): String =
    PLACEHOLDER.replace(template) { escape(value(it.groupValues[1], values)) }

  /** The placeholder names in [template], in order, each as often as it shows. */
  fun names(template: String): List<String> = PLACEHOLDER.findAll(template).map { it.groupValues[1] }.toList()

  fun argv(items: List<ArgvItem>, values: Map<String, String>): List<String> = items.flatMap { item ->
    when (item) {
      is ArgvItem.Text -> listOf(render(item.template, values))
      is ArgvItem.When -> if (value(item.placeholder, values).isEmpty()) emptyList() else item.args.map { render(it, values) }
    }
  }

  /** Each value rendered, in manifest order. */
  fun env(env: Map<String, String>, values: Map<String, String>): Map<String, String> =
    env.mapValuesTo(LinkedHashMap()) { render(it.value, values) }

  /** encodeURIComponent: every UTF-8 byte but A-Z a-z 0-9 - _ . ! ~ * ' ( ) as %XX. */
  fun uriComponent(value: String): String {
    val out = StringBuilder(value.length)
    for (byte in value.toByteArray(Charsets.UTF_8)) {
      val b = byte.toInt() and 0xff
      val c = b.toChar()
      if (c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c in UNESCAPED) {
        out.append(c)
      } else {
        out.append('%').append(HEX[b shr 4]).append(HEX[b and 0xf])
      }
    }
    return out.toString()
  }

  private fun value(name: String, values: Map<String, String>): String {
    if (name !in KNOWN) throw KindException("unknown placeholder {{$name}}")
    return values[name] ?: throw KindException("{{$name}} has no value here")
  }

  private const val UNESCAPED = "-_.!~*'()"
  private const val HEX = "0123456789ABCDEF"
}
