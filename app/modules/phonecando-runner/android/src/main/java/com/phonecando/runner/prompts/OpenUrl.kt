package com.phonecando.runner.prompts

// Which links an agent may ask the phone to open (`phonecando-open <url>`,
// read from its events file): http or https only, at most MAX_BYTES, no
// whitespace or control characters, and a host. The host is what the app
// and the notification name ("<agent> wants to open <host>"): the part of
// the authority after any user info and before the port, so
// `https://good.example@evil.example/` names evil.example, where it goes.
// Pure.
object OpenUrl {
  const val MAX_BYTES = 2048

  private val SCHEME = Regex("^https?://")
  private val HOST = Regex("[A-Za-z0-9.-]+|\\[[0-9A-Fa-f:.]+]")

  /** The link's host when we open it; null when we refuse it. */
  fun hostOf(url: String): String? {
    if (!SCHEME.containsMatchIn(url)) return null
    if (url.toByteArray(Charsets.UTF_8).size > MAX_BYTES) return null
    if (url.any { it.isWhitespace() || it.isISOControl() }) return null
    val authority = url.substringAfter("://").takeWhile { it != '/' && it != '?' && it != '#' }
    val hostPort = authority.substringAfterLast('@')
    val host = if (hostPort.startsWith("[")) hostPort.substringBefore(']') + "]" else hostPort.substringBefore(':')
    return host.takeIf { HOST.matches(it) && it.any(Char::isLetterOrDigit) }
  }
}
