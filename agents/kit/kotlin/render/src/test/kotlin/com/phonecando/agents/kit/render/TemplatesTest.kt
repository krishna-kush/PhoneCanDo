package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ArgvItem
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TemplatesTest {
  private val values = mapOf("libDir" to "/lib", "sessionId" to "", "projectDir" to "/p q")

  @Test fun fillsPlaceholdersAndLeavesTheRest() {
    assertEquals("/lib/x.so", Templates.render("{{libDir}}/x.so", values))
    assertEquals("\${HOME}/{lib}/{{ }", Templates.render("\${HOME}/{lib}/{{ }", values))
    // A value is inserted as is, never read as a pattern.
    assertEquals("a\$1\\b", Templates.render("{{libDir}}", mapOf("libDir" to "a\$1\\b")))
  }

  @Test fun unknownOrMissingPlaceholdersThrow() {
    assertEquals("unknown placeholder {{nope}}", assertFailsWith<KindException> { Templates.render("{{nope}}", values) }.message)
    assertEquals("unknown placeholder {{ libDir }}", assertFailsWith<KindException> { Templates.render("{{ libDir }}", values) }.message)
    assertEquals("{{port}} has no value here", assertFailsWith<KindException> { Templates.render("{{port}}", values) }.message)
  }

  @Test fun conditionalArgs() {
    val argv = listOf(
      ArgvItem.Text("run"),
      ArgvItem.When("sessionId", listOf("--session", "{{sessionId}}")),
      ArgvItem.When("projectDir", listOf("--dir", "{{projectDir}}")),
    )
    assertEquals(listOf("run", "--dir", "/p q"), Templates.argv(argv, values))
    assertEquals(
      listOf("run", "--session", "s1", "--dir", "/p q"),
      Templates.argv(argv, values + ("sessionId" to "s1")),
    )
    assertFailsWith<KindException> { Templates.argv(listOf(ArgvItem.When("port", emptyList())), values) }
  }

  @Test fun envKeepsItsOrder() {
    val env = linkedMapOf("Z" to "{{libDir}}", "A" to "1", "M" to "{{projectDir}}")
    assertEquals(listOf("Z" to "/lib", "A" to "1", "M" to "/p q"), Templates.env(env, values).toList())
  }

  @Test fun uriComponentMatchesEncodeUriComponent() {
    // encodeURIComponent("a b/c~*'()!é?&=+#") in node.
    assertEquals("a%20b%2Fc~*'()!%C3%A9%3F%26%3D%2B%23", Templates.uriComponent("a b/c~*'()!é?&=+#"))
    assertEquals("ses_AZaz09-.", Templates.uriComponent("ses_AZaz09-."))
    assertEquals("/s/a%2Fb", Templates.render("/s/{{sessionId}}", mapOf("sessionId" to "a/b"), Templates::uriComponent))
  }
}
