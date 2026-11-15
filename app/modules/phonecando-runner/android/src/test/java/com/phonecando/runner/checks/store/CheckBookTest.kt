package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// One record per kind and capability, the newest signal winning; the same
// finding again only moves on; one notification per setting, CLI version
// and failure.
class CheckBookTest {
  private val book = CheckBook()

  private fun checked(at: Long, key: String = "1:aa", cli: String = "1.0", agent: String = "a") =
    CheckRecord(CheckState.CHECKED, key, cli, at, agent, null, null)

  private fun failed(at: Long, code: String = "no_hook", key: String = "1:aa", cli: String = "1.0", agent: String = "a", detail: String = "why $at") =
    CheckRecord(CheckState.FAILED, key, cli, at, agent, code, detail)

  @Test fun theNewestSignalWins() {
    book.put("k", Capability.MESSAGES, checked(1))
    assertEquals(failed(2), book.put("k", Capability.MESSAGES, failed(2)).record)
    assertEquals(checked(3), book.put("k", Capability.MESSAGES, checked(3)).record)
    assertEquals(mapOf(Capability.MESSAGES to checked(3)), book.of("k"))
    assertEquals(emptyMap<Capability, CheckRecord>(), book.of("other"))
  }

  @Test fun theSameFindingAgainOnlyMovesOn() {
    book.put("k", Capability.TASK, failed(1, code = "quit_error", detail = "first"))
    val again = book.put("k", Capability.TASK, failed(5, code = "quit_error", cli = "1.1", agent = "b", detail = "second")).record
    assertEquals(failed(5, code = "quit_error", cli = "1.1", agent = "b", detail = "first"), again)
    // Another code is another finding: it replaces the record whole.
    assertEquals("quit_ok", book.put("k", Capability.TASK, failed(6, code = "quit_ok", detail = "ok")).record.code)
    // Another setting too.
    assertEquals("third", book.put("k", Capability.TASK, failed(7, code = "quit_ok", key = "2:bb", detail = "third")).record.detail)
  }

  @Test fun aFailureIsNotifiedOncePerSettingCliVersionAndCode() {
    assertTrue(book.put("k", Capability.WAKE, failed(1)).firstFailure)
    assertFalse(book.put("k", Capability.WAKE, failed(2)).firstFailure)
    // A success between does not make the same failure new.
    assertFalse(book.put("k", Capability.WAKE, checked(3)).firstFailure)
    assertFalse(book.put("k", Capability.WAKE, failed(4)).firstFailure)
    // A new CLI version, a new setting or a new code is.
    assertTrue(book.put("k", Capability.WAKE, failed(5, cli = "1.1")).firstFailure)
    assertTrue(book.put("k", Capability.WAKE, failed(6, cli = "1.1", key = "2:bb")).firstFailure)
    assertTrue(book.put("k", Capability.WAKE, failed(7, cli = "1.1", key = "2:bb", code = "no_receipt")).firstFailure)
    // Each kind and capability has its own.
    assertTrue(book.put("k", Capability.TOOLS, failed(8)).firstFailure)
    assertTrue(book.put("j", Capability.WAKE, failed(9)).firstFailure)
  }

  @Test fun loadReplacesWhatItHeld() {
    book.put("k", Capability.TOOLS, checked(1))
    book.load(mapOf("j" to mapOf(Capability.ACP to Stored(failed(2, code = "acp_failed"), "1:aa|1.0|acp_failed"))))
    assertEquals(emptyMap<Capability, CheckRecord>(), book.of("k"))
    // Loaded as notified: the same failure again is no first.
    assertFalse(book.put("j", Capability.ACP, failed(3, code = "acp_failed")).firstFailure)
  }
}
