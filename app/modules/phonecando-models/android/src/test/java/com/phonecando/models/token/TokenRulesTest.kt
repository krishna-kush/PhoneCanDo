package com.phonecando.models.token

import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class TokenRulesTest {
  @Test
  fun `a pasted token is trimmed`() {
    assertEquals("hf_abcDEF123", TokenRules.clean("  hf_abcDEF123\n"))
  }

  @Test
  fun `blank, spaced or overlong input is refused without repeating it`() {
    for (bad in listOf("", "   ", "hf_abc def", "hf_\u0000x", "hf_é", "x".repeat(TokenRules.MAX_CHARS + 1))) {
      val e = assertThrows(ModelError::class.java) { TokenRules.clean(bad) }
      assertEquals(ModelErrorCode.INVALID_TOKEN, e.code)
      if (bad.isNotBlank()) assertFalse(e.message!!.contains(bad.trim()))
    }
  }
}
