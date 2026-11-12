package com.phonecando.runner.messages

import org.junit.Assert.assertEquals
import org.junit.Test

// What is left of an agent's text: no control, bidi, zero-width or tag
// characters; line breaks as \n; tabs and real text (emoji included) kept.
class MessageTextTest {
  @Test fun controlAndInvisibleCharactersGo() {
    // C0 (an escape sequence loses its ESC), DEL and C1.
    assertEquals("a[31mb", MessageText.clean("a\u0000\u0007\u001b[31m\u007fb"))
    assertEquals("ab", MessageText.clean("a\u0085\u009bb"))
    // Bidi overrides, embeddings, isolates and marks.
    assertEquals("x", MessageText.clean("x⁦⁧⁨⁩‪‫‬‭‮‎‏؜"))
    // Zero-width spaces and joiners, the BOM.
    assertEquals("abc", MessageText.clean("a​b‍﻿c⁠"))
    // Tag characters (U+E0000 block) hide text from a reader.
    assertEquals("ok", MessageText.clean("ok" + String(Character.toChars(0xE0041)) + String(Character.toChars(0xE007F))))
  }

  @Test fun linesAndTabsStay() {
    assertEquals("one\ntwo\nthree\nfour\n\tfive", MessageText.clean("one\r\ntwo\rthree four\n\tfive  \n\n"))
    assertEquals("build ok 🚀", MessageText.clean("build ok 🚀"))
    assertEquals("", MessageText.clean(" ​\n"))
  }

  @Test fun oneLineForNames() {
    assertEquals("Builder two", MessageText.oneLine("  Builder\ntwo‮ "))
    assertEquals("x".repeat(80), MessageText.oneLine("x".repeat(200)))
  }
}
