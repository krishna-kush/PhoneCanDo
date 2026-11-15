package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CapabilityView
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState
import org.junit.Assert.assertEquals
import org.junit.Test

// The records as an agent reads them: every capability in enum order, off
// when not declared, unchecked when the record is of another setting.
class CheckViewsTest {
  private val declared = setOf(Capability.TOOLS, Capability.MESSAGES, Capability.WAKE)
  private val keys = mapOf(Capability.TOOLS to "1:new", Capability.MESSAGES to "1:new", Capability.WAKE to "1:new")
  private val records = mapOf(
    Capability.TOOLS to CheckRecord(CheckState.CHECKED, "1:new", "2.0", 5L, "a", null, null),
    Capability.MESSAGES to CheckRecord(CheckState.FAILED, "1:old", "1.9", 4L, "a", "no_hook", "why"),
    Capability.CHAT to CheckRecord(CheckState.FAILED, "1:new", "2.0", 6L, "a", "chat_refused", "why"),
  )

  @Test fun eachCapabilityInEnumOrder() {
    val views = CheckViews.of(declared, keys::getValue, records)
    assertEquals(Capability.values().toList(), views.map { it.capability })
    assertEquals(CapabilityView(Capability.TOOLS, CheckState.CHECKED, "2.0", 5L, null, null), views[0])
    // A record of the setting it had before reads as not checked yet.
    assertEquals(CapabilityView(Capability.MESSAGES, CheckState.UNCHECKED, null, null, null, null), views[1])
    assertEquals(CheckState.UNCHECKED, views[2].state)
    // Not declared: off, whatever a record says.
    assertEquals(CapabilityView(Capability.CHAT, CheckState.OFF, null, null, null, null), views.last())
    assertEquals(6, views.count { it.state == CheckState.OFF })
  }

  @Test fun okIsWhatIsDeclaredAndNotFailedNow() {
    assertEquals(declared, CheckViews.ok(declared, keys::getValue, records))
    val failing = records + (Capability.WAKE to CheckRecord(CheckState.FAILED, "1:new", "2.0", 7L, "a", "no_waiter", "why"))
    assertEquals(setOf(Capability.TOOLS, Capability.MESSAGES), CheckViews.ok(declared, keys::getValue, failing))
  }
}
