package com.phonecando.agents.kit.render

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

// ShellRegex: a runtime check pattern as the POSIX ERE the guest's grep and
// sed run, the same subset the TS validator's ereProblem passes.
class ShellRegexTest {
  @Test fun translatesWhatHasAnEreForm() {
    assertEquals("^v([0-9]+)\\.", ShellRegex.ere("^v(\\d+)\\."))
    assertEquals("Python ([0-9]+)[[:space:]][[:alnum:]_]", ShellRegex.ere("Python (\\d+)\\s\\w"))
    assertEquals("[0-9.]+ ([^]a])", ShellRegex.ere("[\\d.]+ ([^]a])"))
    assertEquals("a{2,3}(b)|c", ShellRegex.ere("a{2,3}(b)|c"))
    assertEquals("go([0-9])-x/y", ShellRegex.ere("go(\\d)\\-x\\/y"), "a symbol ERE gives no meaning loses its escape")
  }

  @Test fun refusesWhatHasNone() {
    for (bad in listOf("(?:v)(\\d+)", "(\\d+?)", "(\\d++)", "\\b(\\d+)", "(\\d)\\1", "[\\-a]", "[[:digit:]]", "[abc", "x\\")) {
      assertFailsWith<IllegalArgumentException>(bad) { ShellRegex.ere(bad) }
    }
  }

  @Test fun groupOneForSed() {
    assertEquals("s#^(v([0-9]+)\\.)$#\\2#p", ShellRegex.groupOne("^v([0-9]+)\\."))
    assertEquals("s#^(([0-9]+)|x)$#\\2#p", ShellRegex.groupOne("([0-9]+)|x$"))
    assertEquals("s%^(a#b)$%\\2%p", ShellRegex.groupOne("a#b"), "a delimiter the pattern does not hold")
  }

  @Test fun runsOnTheHostsGrepAndSed() {
    val ere = ShellRegex.ere("(\\d+)\\.")
    val (code, out) = Sh.run(
      "printf 'node 22.11.0\\n' | grep -oE ${ShellQuote.word(ere)} | head -n 1 | sed -nE ${ShellQuote.word(ShellRegex.groupOne(ere))}",
    )
    assertEquals(0 to "22\n", code to out, "the first match's group 1, as Java's find() gives it")
  }
}
