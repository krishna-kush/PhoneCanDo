package com.phonecando.agents.kit.render

// The version a version check printed: group 1 of the manifest's pattern at
// its first match in the output (find, not a whole-output match), trimmed.
object VersionParse {
  /** Null when [pattern] does not match [output], or has no group 1 or an empty one. */
  fun parse(output: String, pattern: String): String? =
    Regex(pattern).find(output)?.groupValues?.getOrNull(1)?.trim()?.ifEmpty { null }
}
