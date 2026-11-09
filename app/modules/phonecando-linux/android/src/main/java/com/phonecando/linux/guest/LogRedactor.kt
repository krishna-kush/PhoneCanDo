package com.phonecando.linux.guest

/**
 * Takes credentials out of a line of guest output before it reaches the
 * install log or a progress event: the user info of a URL, header-style
 * credentials, Bearer/Basic values, `name=value` pairs whose name says
 * token, secret, password or key, and common provider key shapes. Each
 * becomes `<secret>`, which no pattern matches again, so redacting twice
 * changes nothing. Pure.
 */
internal object LogRedactor {
  const val SECRET = "<secret>"

  // scheme://user:pass@host -> scheme://<secret>@host
  private val URL_USER_INFO = Regex("\\b([A-Za-z][A-Za-z0-9+.-]*://)[^\\s/@<>]+@")

  // Authorization: Bearer x, x-api-key=x; the label and any scheme stay. The scheme is possessive,
  // so a redacted value is never taken for one whose value is the scheme itself.
  private val AUTH_HEADER = Regex(
    "(?i)\\b((?:proxy-)?authorization|x-api-key|api-key)([\"']?\\s*[:=]\\s*[\"']?)((?:bearer|basic|token)\\s+)?+[^\\s\"',;<]+",
  )

  // A credential after its scheme anywhere else, e.g. in a curl line.
  private val AUTH_SCHEME = Regex("(?i)\\b(bearer|basic)([ \\t]+)[A-Za-z0-9._~+/-]{8,}=*")

  // NPM_TOKEN=x, ?access_token=x&, "password": "x"; the name stays. A ':' counts only before a
  // space or a quote, so a package spelled `passwd:arm64` stays as it is; a scheme is never the value.
  private val SECRET_PAIR = Regex(
    "(?i)\\b([A-Za-z0-9_.-]*(?:token|secret|passw(?:or)?d|api[_-]?key|access[_-]?key|credentials?)[A-Za-z0-9_.-]*)" +
      "([\"']?\\s*(?:=|:(?=[\\s\"']))\\s*[\"']?)(?!(?:bearer|basic|token)\\s)([^\\s\"'&,;<]+)",
  )

  // API key shapes: OpenAI, Anthropic and OpenRouter (sk-), Groq, xAI, GitHub, Google, Slack, npm, GitLab.
  private val PROVIDER_KEY = Regex("\\b(?:sk-|gsk_|xai-|gh[opsu]_|github_pat_|AIza|xox[abpr]-|npm_|glpat-)[A-Za-z0-9_-]{16,}")

  fun redact(line: String): String {
    var out = URL_USER_INFO.replace(line) { it.groupValues[1] + SECRET + "@" }
    out = AUTH_HEADER.replace(out) { m -> m.groupValues[1] + m.groupValues[2] + m.groupValues[3] + SECRET }
    out = AUTH_SCHEME.replace(out) { m -> m.groupValues[1] + m.groupValues[2] + SECRET }
    out = SECRET_PAIR.replace(out) { m -> m.groupValues[1] + m.groupValues[2] + SECRET }
    return PROVIDER_KEY.replace(out, SECRET)
  }
}
