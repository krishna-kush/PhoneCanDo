package com.phonecando.models.token

import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode

/**
 * What we take as a Hugging Face token: the typed text trimmed, one word of
 * printable ASCII, at most [MAX_CHARS]. We never check it against the Hub
 * here; a wrong token shows as access_denied on the next call. Pure. The
 * message never repeats the input.
 */
object TokenRules {
  const val MAX_CHARS = 256

  fun clean(input: String): String {
    val token = input.trim()
    if (token.isEmpty()) throw invalid("the token is empty")
    if (token.length > MAX_CHARS) throw invalid("a token is at most $MAX_CHARS characters")
    if (token.any { it.code <= 0x20 || it.code >= 0x7f }) throw invalid("a token is one word of letters, digits and symbols")
    return token
  }

  private fun invalid(reason: String) = ModelError(ModelErrorCode.INVALID_TOKEN, reason)
}
