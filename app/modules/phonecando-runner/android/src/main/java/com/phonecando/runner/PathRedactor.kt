package com.phonecando.runner

import com.phonecando.agents.kit.AgentKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.KindCatalog

// Redaction for everything telemetry keeps as text: crash messages and
// frames, and the engine stderr tail. Pure JVM (no Android imports), so
// src/test runs it on the JVM.
//
// Paths: a whole path becomes `<path>`, never just its prefix. A path starts
// at one of this app's dirs (given as literals) or at a storage location
// (/data/user/N, /data/user_de/N, /data/data, /data/media/N, /data/app,
// /storage/<any>, /sdcard, /mnt/<any>, ~/, file://, content://, and the
// URL-encoded /data, /storage, /sdcard and /mnt) and runs until whitespace or
// one of '"`()<>[]{},;. A path that starts right after an opening quote
// (" ' `) runs to the matching closing quote on the same line instead,
// spaces included (`open '/sdcard/My File.txt'` -> `open '<path>'`); a
// backslash escapes the next character there, as in a JSON string. With no
// closing quote on the line, an unquoted path that a Java file-error suffix
// (`: open failed:`, ` (No such file or directory)`, ` (Permission denied)`,
// ` (Is a directory)`, ` (Read-only file system)`) ends later on the same
// line runs up to it, spaces included; otherwise the unquoted rule applies.
// Either way only a trailing `:line` or `:line:col` (a stack frame) stays.
// This matches tce/core/redact.ts. Secrets: the given values (every agent's engine password, its Basic
// credential, bridge token, and the local model server's keys,
// models/ModelServerKeys), Authorization / x-api-key header values,
// Bearer/Basic credentials and common provider key shapes become `<secret>`.
// The placeholders start with '<', itself a stop, so redacting twice changes
// nothing.
internal class PathRedactor private constructor(
  // A path start right after a quote (group 1), else a whole unquoted path.
  private val paths: Regex,
  // A whole unquoted path: a quoted start whose line has no closing quote.
  private val unquoted: Regex,
) {
  fun redact(text: String, secrets: Collection<String> = emptyList()): String {
    if (text.isEmpty()) return text
    // Secrets first, as MARK: not a stop, so a secret-shaped path segment
    // ("…/sk-learn-…/salaries.csv") leaves its path whole for the path pass.
    var out = text
    for (s in secrets.filter { it.length >= MIN_SECRET_CHARS }.sortedByDescending { it.length }) {
      out = out.replace(s, MARK)
    }
    out = AUTH_HEADER.replace(out) { m -> m.groupValues[1] + m.groupValues[2] + m.groupValues[3] + MARK }
    out = AUTH_SCHEME.replace(out) { m -> m.groupValues[1] + m.groupValues[2] + MARK }
    out = PROVIDER_KEY.replace(out, MARK)
    out = redactPaths(out)
    return out.replace(MARK, SECRET)
  }

  // One left-to-right pass, so a replacement is never matched again. Where
  // a path ends, in order: the closing quote of a quoted path; a Java
  // file-error suffix later on the line; else the unquoted rule. The first
  // two are found by plain scans, not by the regex: java.util.regex recurses
  // once per repetition of a group like (?:[^"\\]|\\.)*, which a long line
  // would turn into a stack overflow, and on the crashing thread at that.
  private fun redactPaths(text: String): String {
    var m = paths.find(text) ?: return text
    val ends = FileErrorEnds(text)
    // Per opening quote, where the line ends that is known to hold no closing
    // one: a failed scan is not repeated for later starts on that line.
    val noCloseUntil = IntArray(QUOTES.length) { -1 }
    val out = StringBuilder(text.length)
    var i = 0
    while (true) {
      val start = m.range.first
      val quotedStart = m.groups[1] != null
      out.append(text, i, start)
      var close = -1
      if (quotedStart) {
        val q = QUOTES.indexOf(text[start - 1])
        if (start >= noCloseUntil[q]) {
          close = closingQuote(text, m.range.last + 1, QUOTES[q])
          if (close < 0) noCloseUntil[q] = -1 - close
        }
      }
      val end = if (close >= 0) close else ends.after(start)
      i = if (end >= 0) {
        out.append(PATH).append(END_TRAILER.find(text.substring(start, end))?.value ?: "")
        end
      } else {
        out.append(PATH)
        // A plain match already is the whole path; a quoted start without a
        // closing quote takes the unquoted rule, which matches where it does.
        (if (quotedStart) unquoted.find(text, start) ?: m else m).range.last + 1
      }
      m = paths.find(text, i) ?: break
    }
    out.append(text, i, text.length)
    return out.toString()
  }

  // Java/Android file errors end an unquoted path with a known suffix, so a
  // path with spaces runs whole up to the first one on its line:
  //   FileNotFoundException: /storage/…/Tax Return 2025.pdf: open failed: ENOENT (…)
  //   /sdcard/My Docs/plan v2.txt (No such file or directory)
  // Lookups come in increasing order (one redactPaths pass), so the suffix
  // positions are found once and both cursors only move forward: linear.
  private class FileErrorEnds(private val text: String) {
    private val at: IntArray = FILE_ERROR_END.findAll(text).map { it.range.first }.toList().toIntArray()
    private var next = 0
    private var lineEnd = -1

    // Where the first suffix after `start` begins, if on the same line; else -1.
    fun after(start: Int): Int {
      while (next < at.size && at[next] <= start) next++
      if (next == at.size) return -1
      if (lineEnd < start) {
        lineEnd = start
        while (lineEnd < text.length && text[lineEnd] != '\n' && text[lineEnd] != '\r') lineEnd++
      }
      return if (at[next] < lineEnd) at[next] else -1
    }
  }

  // The last ≤ maxBytes (UTF-8) of a log, redacted; null when nothing is
  // left. `window` is the end of the log; `midFile` says it does not start at
  // the log's first byte. Redaction runs on the whole window before the cut,
  // so every path and secret that starts inside it is seen whole. Only the
  // window's own start can split one: that cut-off fragment is dropped (see
  // dropCutFragment), however long the line it sits in. The final cut lands
  // on a UTF-8 character boundary and can only shorten redacted text.
  fun tail(
    window: ByteArray,
    midFile: Boolean,
    maxBytes: Int,
    secrets: Collection<String> = emptyList(),
  ): String? {
    var from = 0
    if (midFile) while (from < window.size && isContinuation(window[from])) from++
    var text = redact(String(window, from, window.size - from, Charsets.UTF_8), secrets)
    if (midFile) text = dropCutFragment(text)
    val bytes = text.toByteArray(Charsets.UTF_8)
    if (bytes.size > maxBytes) {
      var start = bytes.size - maxBytes
      while (start < bytes.size && isContinuation(bytes[start])) start++
      text = String(bytes, start, bytes.size - start, Charsets.UTF_8)
      // Whole lines read better; a text with no line break stays as it is.
      val nl = text.indexOf('\n')
      if (nl >= 0 && nl < text.length - 1) text = text.substring(nl + 1)
    }
    return text.trimEnd().ifEmpty { null }
  }

  companion object {
    const val PATH = "<path>"
    const val SECRET = "<secret>"

    // Shorter values are not secrets we generate, and replacing them would
    // eat unrelated text.
    private const val MIN_SECRET_CHARS = 8

    // A secret during redaction: a private-use character, so it is part of
    // a path, matches no pattern, and ends up as SECRET (as would one that
    // was in the input).
    private const val MARK = "\uE000"

    // What ends a path, as a regex class body: ASCII whitespace (exactly
    // regex \s) and '"`()<>[]{},;. isStop() is the same set.
    private const val STOPS = "\\s'\"`()<>\\[\\]{},;"
    private const val STOP_PUNCTUATION = "'\"`()<>[]{},;"

    // The rest of a path after its start: up to the first stop, minus a
    // trailing :line or :line:col.
    private const val REST = "[^$STOPS]*?(?=(?::\\d+){0,2}(?:[$STOPS]|\$))"

    // Opening quotes after which a path runs to the matching closing quote.
    private const val QUOTES = "\"'`"

    // The :line or :line:col a quoted or suffix-ended path gives back (REST's rule).
    private val END_TRAILER = Regex("(?::\\d+){1,2}$")

    // Where a Java file-error suffix begins (zero width, so overlapping
    // occurrences are all found). Case-insensitive, as in tce/core/redact.ts.
    private val FILE_ERROR_END = Regex(
      "(?=: open failed:| \\((?:No such file or directory|Permission denied|Is a directory|Read-only file system)\\))",
      RegexOption.IGNORE_CASE,
    )

    private val PATH_STARTS = listOf(
      "(?i:file|content)://",
      // URL-encoded, also double-encoded (%252F).
      "(?i:%(?:25)?2F(?:data|storage|sdcard|mnt))\\b",
      "/data/(?:user|user_de|media)/\\d+",
      "/data/(?:data|app)\\b",
      "/storage/[^/$STOPS]+",
      "/sdcard",
      "/mnt/",
      // ~/ at the start of a word, an assignment or a key: value.
      "(?<![^$STOPS=:])~/",
    )

    // Header-style credentials, also as JSON keys: the label and any scheme
    // stay, the value goes. The scheme is possessive so an already redacted
    // value is not matched again as "Bearer" being the value.
    private val AUTH_HEADER = Regex(
      "(?i)\\b((?:proxy-)?authorization|x-api-key|api-key)([\"']?\\s*[:=]\\s*[\"']?)" +
        "((?:bearer|basic|digest|token)\\s+)?+[^$STOPS]+",
    )

    // A credential after its scheme anywhere else, e.g. in a curl line.
    private val AUTH_SCHEME = Regex("(?i)\\b(bearer|basic)([ \\t]+)[A-Za-z0-9._~+/-]{8,}=*")

    // API key shapes of the providers opencode talks to (OpenAI, Anthropic,
    // OpenRouter: sk-…; Groq; xAI; GitHub; Google).
    private val PROVIDER_KEY = Regex("\\b(?:sk-|gsk_|xai-|gh[opsu]_|github_pat_|AIza)[A-Za-z0-9_-]{16,}")

    // Labels whose next token is a credential: when a window starts inside
    // one, or right after one, the redactor never saw the label.
    private val CREDENTIAL_LABELS = listOf(
      "authorization", "proxy-authorization", "x-api-key", "api-key",
      "bearer", "basic", "digest", "token",
    )

    // Generic patterns only: the fallback before the app's dirs are known.
    // Declared after PATH_STARTS, which forDirs reads.
    val BASE = forDirs(emptyList())

    // `dirs`: this app's home dirs (data dir, files dir; as given and
    // canonical). Each must be absolute and longer than 8 chars, so a bare
    // "/" or a short prefix can never eat unrelated text.
    fun forDirs(dirs: Collection<String>): PathRedactor {
      val literals = dirs
        .map { it.trimEnd('/') }
        .filter { it.startsWith("/") && it.length > 8 }
        .distinct()
        .sortedByDescending { it.length }
        .map { Regex.escape(it) }
      val starts = (literals + PATH_STARTS).joinToString("|")
      val unquoted = "(?:$starts)$REST"
      // The quoted start first, so it wins over the unquoted rule at the
      // same position; group 1 tells them apart.
      return PathRedactor(Regex("((?<=[$QUOTES])(?:$starts))|$unquoted"), Regex(unquoted))
    }

    // The engine's own secrets: every form of its password the kind knows
    // (the raw value, its HTTP Basic credential…) and the bridge token.
    fun engineSecrets(kind: AgentKind, password: String?, bridgeToken: String?): List<String> {
      val out = ArrayList<String>(3)
      if (!password.isNullOrEmpty()) out += kind.passwordForms(password)
      if (!bridgeToken.isNullOrEmpty()) out += bridgeToken
      return out
    }

    // Every agent's secrets: one engine's log or a crash can carry another
    // agent's password or token. An agent of a kind this build lacks still
    // has its raw password and token redacted.
    fun agentSecrets(agents: Collection<AgentRecord>, kinds: KindCatalog): List<String> = agents.flatMap { a ->
      val kind = kinds.get(a.kind)
      if (kind != null) {
        engineSecrets(kind, a.password, a.bridgeToken)
      } else {
        listOf(a.password, a.bridgeToken).filter { it.isNotEmpty() }
      }
    }

    fun isStop(c: Char): Boolean = c == ' ' || c in '\t'..'\r' || STOP_PUNCTUATION.indexOf(c) >= 0

    // Index of the quote `q` that closes a quoted path whose body starts at
    // `from`; when the line has none, -1 - (where the line ends). A
    // backslash escapes the next character (`\"` in a JSON string does not
    // close it), except a line break. Why quotes are special: a quoted path
    // is the one place a path is known to end at the quote rather than at a
    // space, so a file name with spaces is consumed whole instead of leaking
    // its rest.
    fun closingQuote(text: String, from: Int, q: Char): Int {
      var j = from
      while (j < text.length) {
        val c = text[j]
        when {
          c == q -> return j
          c == '\n' || c == '\r' -> return -1 - j
          c == '\\' && j + 1 < text.length && text[j + 1] != '\n' && text[j + 1] != '\r' -> j += 2
          else -> j++
        }
      }
      return -1 - text.length
    }

    // Drops what a mid-file window starts with up to its first safe boundary.
    // `text` is already redacted. When another line follows, that is the
    // whole first line (a path or header never spans a line break).
    // Otherwise the window is the end of one line longer than itself, so only
    // the cut-off token goes: the run before the first stop. When that run
    // could be the end of a credential label ("…earer", "…ization:"), or is
    // empty because the cut fell on a stop, the token after it goes too: it
    // may be a credential whose label lay before the window. Placeholders
    // start with '<', a stop, so they are never part of a dropped run.
    fun dropCutFragment(text: String): String {
      val nl = text.indexOf('\n')
      if (nl >= 0 && text.substring(nl + 1).isNotBlank()) return text.substring(nl + 1)
      var i = runEnd(text, 0)
      val fragment = text.substring(0, i).lowercase().trimEnd(':', '=')
      if (CREDENTIAL_LABELS.any { it.endsWith(fragment) }) {
        while (i < text.length && isStop(text[i]) && !startsWithPlaceholder(text, i)) i++
        i = runEnd(text, i)
      }
      return text.substring(i)
    }

    private fun runEnd(text: String, from: Int): Int {
      var i = from
      while (i < text.length && !isStop(text[i])) i++
      return i
    }

    private fun startsWithPlaceholder(text: String, at: Int): Boolean =
      text.startsWith(PATH, at) || text.startsWith(SECRET, at)

    private fun isContinuation(b: Byte): Boolean = (b.toInt() and 0xC0) == 0x80
  }
}
