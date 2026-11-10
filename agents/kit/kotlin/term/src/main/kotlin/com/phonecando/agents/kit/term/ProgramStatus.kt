package com.phonecando.agents.kit.term

import java.util.Base64

// The Program Status Protocol, OSC 7501, revision 0.2 (2026-10-06):
// https://www.superlogical.com/rex/docs/build/program-status. A program
// says what it is doing as `OSC 7501 ; key=value:key=value ST`, and asks
// whether the terminal speaks it with `OSC 7501 ; ? ST`, which a terminal
// that does answers with the same body. parse() applies every rule under
// which the spec discards or ignores a report and words the rest one way:
// `state=<state>`, then `id`, `kind`, `progress`, `app`, `title` and `msg`
// as far as the report has them, joined by `:`. Values are as sent (title
// and msg stay base64), less the ones the spec treats as absent (a kind
// off a blocked report, progress off a working or blocked one, an app
// outside its character set); unknown keys go. Pure.
object ProgramStatus {
  const val COMMAND = "7501"

  /** The body of the support query, and of the reply. */
  const val QUERY = "?"

  /** The states a report may carry; `clear` is none, but a report may say it. */
  val STATES = listOf("idle", "working", "done", "blocked", "error", "clear")
  val KINDS = listOf("permission", "question", "auth")

  // Limits: a report past one is discarded whole.
  const val MAX_SEQUENCE = 4096
  private const val MAX_KEY = 16
  private const val MAX_APP = 32
  private const val MAX_ID = 128
  private const val MAX_DEPTH = 8
  private class Text(val key: String, val encoded: Int, val decoded: Int)
  private val TEXTS = listOf(Text("title", 256, 192), Text("msg", 2732, 2048))

  private val KEY = Regex("[a-z]+")
  private val VALUE = Regex("[A-Za-z0-9_.,+/=-]*")
  private val SEGMENT = Regex("[A-Za-z0-9_.+-]{1,32}")
  private val APP = Regex("[A-Za-z0-9_.+-]+")
  private val PROGRESS = Regex("[0-9]{1,3}")

  /** The terminal's answer to the support query: `OSC 7501 ; ? ST`, ending as the query did (BEL, else ESC \). */
  fun reply(bel: Boolean): ByteArray = ("\u001b]$COMMAND;$QUERY" + if (bel) "\u0007" else "\u001b\\").toByteArray(Charsets.US_ASCII)

  /**
   * The report in [body] (what follows `7501;`) as its words above, or null
   * when the spec has it discarded or ignored. [sequenceBytes]: the whole
   * sequence, OSC through ST.
   */
  fun parse(body: String, sequenceBytes: Int): String? {
    if (sequenceBytes > MAX_SEQUENCE) return null
    val pairs = HashMap<String, String>()
    for (raw in body.split(':')) {
      val eq = raw.indexOf('=')
      if (eq < 0) continue
      val key = raw.substring(0, eq).trim()
      val value = raw.substring(eq + 1).trim()
      // A malformed pair is skipped; the rest of the report still counts.
      if (!KEY.matches(key) || !VALUE.matches(value)) continue
      if (key.length > MAX_KEY) return null
      pairs[key] = value
    }
    val state = pairs["state"]?.takeIf { it in STATES } ?: return null
    val id = pairs["id"]
    if (id != null && !validId(id)) return null
    val app = pairs["app"]
    if (app != null && app.length > MAX_APP) return null
    for (t in TEXTS) if (!pairs[t.key].let { it == null || validText(it, t) }) return null
    val busy = state == "working" || state == "blocked"
    return buildString {
      append("state=").append(state)
      id?.let { append(":id=").append(it) }
      pairs["kind"]?.takeIf { state == "blocked" && it in KINDS }?.let { append(":kind=").append(it) }
      pairs["progress"]?.takeIf { busy && PROGRESS.matches(it) && it.toInt() <= 100 }?.let { append(":progress=").append(it.toInt()) }
      app?.takeIf { APP.matches(it) }?.let { append(":app=").append(it) }
      for (t in TEXTS) pairs[t.key]?.let { append(':').append(t.key).append('=').append(it) }
    }
  }

  // A report with an id outside the grammar is ignored, one past a limit discarded: either way, nothing.
  private fun validId(id: String): Boolean {
    if (id.length > MAX_ID) return false
    val segments = id.split('/')
    return segments.size <= MAX_DEPTH && segments.all(SEGMENT::matches)
  }

  // Standard base64 of UTF-8 text, padding optional, within its limits, with no control character.
  private fun validText(value: String, limits: Text): Boolean {
    if (value.length > limits.encoded) return false
    val bytes = try {
      Base64.getDecoder().decode(value)
    } catch (_: IllegalArgumentException) {
      return false
    }
    if (bytes.size > limits.decoded) return false
    return bytes.toString(Charsets.UTF_8).none { it in '\u0000'..'\u001f' || it in '\u007f'..'\u009f' }
  }
}
