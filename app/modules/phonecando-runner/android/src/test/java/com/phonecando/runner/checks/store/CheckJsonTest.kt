package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

// files/state/checks.json: written and read back whole; what does not read
// is left out.
class CheckJsonTest {
  private val ok = Stored(CheckRecord(CheckState.CHECKED, "3:0123456789abcdef", "", 10L, "a", null, null), null)
  private val bad = Stored(
    CheckRecord(CheckState.FAILED, "3:fedcba9876543210", "2.1.0", 20L, "b", "no_hook", "none of its hooks ran"),
    "3:fedcba9876543210|2.1.0|no_hook",
  )

  @Test fun recordsRoundTrip() {
    val kinds = mapOf("claude-code" to mapOf(Capability.TOOLS to ok, Capability.ACP_MESSAGES to bad), "pi" to mapOf(Capability.WAKE to ok))
    val text = CheckJson.encode(kinds)
    assertEquals(kinds, CheckJson.decode(text))
    val root = JSONObject(text)
    assertEquals(1, root.getInt("version"))
    assertEquals("failed", root.getJSONObject("kinds").getJSONObject("claude-code").getJSONObject("acpMessages").getString("state"))
  }

  @Test fun whatDoesNotReadIsLeftOut() {
    val text = """
      {"version":1,"kinds":{
        "k":{
          "tools":{"state":"checked","key":"1:aa","cliVersion":"","at":1,"agentId":"a"},
          "teleport":{"state":"checked","key":"1:aa"},
          "wake":{"state":"unchecked","key":"1:aa"},
          "chat":{"state":"failed","key":""},
          "acp":"broken"
        },
        "empty":{"task":{"state":"maybe","key":"1:aa"}}
      }}
    """.trimIndent()
    val read = CheckJson.decode(text)
    assertEquals(setOf("k"), read.keys)
    assertEquals(setOf(Capability.TOOLS), read.getValue("k").keys)
    assertEquals(null, read.getValue("k").getValue(Capability.TOOLS).record.code)
  }

  @Test fun anotherVersionOrNoJsonReadsAsNone() {
    assertEquals(emptyMap<String, Any>(), CheckJson.decode("""{"version":2,"kinds":{"k":{}}}"""))
    assertEquals(emptyMap<String, Any>(), CheckJson.decode("not json"))
    assertEquals(emptyMap<String, Any>(), CheckJson.decode(""))
  }
}
