package com.phonecando.runner.schedule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.time.ZoneOffset

// The book: what a new task must be, the caps, chat defaults, changes
// (a text the user rewrites is the user's), cancelling, waiting firings,
// what is due and when the alarm goes off.
class ScheduleBookTest {
  private var now = 100L * ScheduleRules.DAY_MS
  private var ids = 0
  private var changes = 0
  private val file = File(Files.createTempDirectory("book").toFile(), "state/schedules.json")

  private fun book(refusal: (String) -> ScheduleBook.Result.Refused? = { null }) = ScheduleBook(
    store = ScheduleStore(StateFile(file)),
    clock = { now },
    zone = { ZoneOffset.UTC },
    refusal = refusal,
    newId = { "s" + (++ids).toString().padStart(10, '0') },
    onChange = { changes++ },
  )

  private fun ok(r: ScheduleBook.Result): Schedule = (r as ScheduleBook.Result.Ok).schedule

  private fun refused(r: ScheduleBook.Result): ScheduleBook.Result.Refused = r as ScheduleBook.Result.Refused

  private val inAnHour get() = Timing.Once(now + ScheduleRules.HOUR_MS)

  @Test fun aNewTaskIsCleanedTimedAndDefaulted() {
    val b = book()
    val once = ok(b.add("a1", ScheduleBook.Draft("  check CI​  ", inAnHour), SetBy.AGENT))
    assertEquals("check CI", once.text)
    assertEquals(ChatMode.SAME, once.chat)
    assertEquals(now + ScheduleRules.HOUR_MS, once.nextAt)
    assertTrue(once.on)
    val every = ok(b.add("a1", ScheduleBook.Draft("triage", Timing.Every(60, now)), SetBy.USER))
    assertEquals(ChatMode.NEW, every.chat)
    assertEquals(now + ScheduleRules.HOUR_MS, every.nextAt)
    assertEquals(2, changes)
    // It is on disk.
    assertEquals(listOf(once, every), book().all())
  }

  @Test fun badTextsAndTimesAreRefused() {
    val b = book()
    fun code(text: String, timing: Timing) = refused(b.add("a1", ScheduleBook.Draft(text, timing), SetBy.USER)).code
    assertEquals(ScheduleBook.BAD, code(" \n", inAnHour))
    assertEquals(ScheduleBook.BAD, code("x".repeat(ScheduleRules.MAX_TEXT + 1), inAnHour))
    assertEquals(ScheduleBook.BAD, code("t", Timing.Once(now)))
    assertEquals(ScheduleBook.BAD, code("t", Timing.Once(now + ScheduleRules.ONCE_MAX_AHEAD_MS + 1)))
    assertEquals(ScheduleBook.BAD, code("t", Timing.Every(ScheduleRules.EVERY_MIN_MINUTES - 1, now)))
    assertEquals(ScheduleBook.BAD, code("t", Timing.Daily(24 * 60, emptySet())))
    ok(b.add("a1", ScheduleBook.Draft("x".repeat(ScheduleRules.MAX_TEXT), Timing.Every(ScheduleRules.EVERY_MIN_MINUTES, now)), SetBy.USER))
    assertEquals(1, b.all().size)
  }

  @Test fun anAgentThatCannotHaveThemIsRefused() {
    val b = book { if (it == "gone") ScheduleBook.Result.Refused(ScheduleBook.AGENT_GONE, "no such agent") else null }
    assertEquals(ScheduleBook.AGENT_GONE, refused(b.add("gone", ScheduleBook.Draft("t", inAnHour), SetBy.USER)).code)
  }

  @Test fun capsPerAgentAndForWhatAnAgentSets() {
    val b = book()
    repeat(ScheduleRules.MAX_BY_AGENT) { ok(b.add("a1", ScheduleBook.Draft("t$it", inAnHour), SetBy.AGENT)) }
    assertEquals(ScheduleBook.LIMIT, refused(b.add("a1", ScheduleBook.Draft("one more", inAnHour), SetBy.AGENT)).code)
    // The user may still add up to the agent's cap; another agent has its own.
    repeat(ScheduleRules.MAX_PER_AGENT - ScheduleRules.MAX_BY_AGENT) { ok(b.add("a1", ScheduleBook.Draft("u$it", inAnHour), SetBy.USER)) }
    assertEquals(ScheduleBook.LIMIT, refused(b.add("a1", ScheduleBook.Draft("full", inAnHour), SetBy.USER)).code)
    ok(b.add("a2", ScheduleBook.Draft("t", inAnHour), SetBy.AGENT))
  }

  @Test fun changesRetimeAndTheUsersWordsMakeItTheirs() {
    val b = book()
    val s = ok(b.add("a1", ScheduleBook.Draft("check CI", inAnHour), SetBy.AGENT))
    val off = ok(b.update(s.id, ScheduleBook.Patch(on = false)))
    assertFalse(off.on)
    assertNull(off.nextAt)
    val back = ok(b.update(s.id, ScheduleBook.Patch(on = true)))
    assertEquals(s.nextAt, back.nextAt)
    // Chat alone keeps the time and who set it.
    val chat = ok(b.update(s.id, ScheduleBook.Patch(chat = ChatMode.NEW)))
    assertEquals(SetBy.AGENT, chat.by)
    assertEquals(s.nextAt, chat.nextAt)
    assertEquals(SetBy.USER, ok(b.update(s.id, ScheduleBook.Patch(text = "check CI and deploy"))).by)
    val daily = ok(b.update(s.id, ScheduleBook.Patch(timing = Timing.Daily(0, emptySet()))))
    assertEquals(now + ScheduleRules.DAY_MS, daily.nextAt)
    assertEquals(ScheduleBook.NOT_FOUND, refused(b.update("nope", ScheduleBook.Patch(on = false))).code)
    assertEquals(ScheduleBook.BAD, refused(b.update(s.id, ScheduleBook.Patch(timing = Timing.Once(now - 1)))).code)
  }

  @Test fun anAgentCancelsOnlyItsOwn() {
    val b = book()
    val mine = ok(b.add("a1", ScheduleBook.Draft("mine", inAnHour), SetBy.AGENT))
    val users = ok(b.add("a1", ScheduleBook.Draft("users", inAnHour), SetBy.USER))
    val other = ok(b.add("a2", ScheduleBook.Draft("other", inAnHour), SetBy.AGENT))
    assertEquals(ScheduleBook.NOT_ALLOWED, refused(b.cancelByAgent("a1", users.id)).code)
    assertEquals(ScheduleBook.NOT_FOUND, refused(b.cancelByAgent("a1", other.id)).code)
    ok(b.cancelByAgent("a1", mine.id))
    assertEquals(listOf(users, other), b.all())
    assertTrue(b.forget("a1"))
    assertFalse(b.forget("a1"))
    assertEquals(listOf(other), b.all())
  }

  @Test fun dueOnesMoveOnAndTheAlarmIsTheSoonestNeed() {
    val b = book()
    val once = ok(b.add("a1", ScheduleBook.Draft("once", inAnHour), SetBy.USER))
    val every = ok(b.add("a1", ScheduleBook.Draft("every", Timing.Every(30, now)), SetBy.USER))
    assertEquals(every.nextAt, b.nextAlarm())
    now += ScheduleRules.HOUR_MS
    val due = b.takeDue()
    assertEquals(setOf(once.id, every.id), due.map { it.schedule.id }.toSet())
    assertNull(b.get(once.id)!!.nextAt)
    assertEquals(now + 30 * ScheduleRules.MINUTE_MS, b.get(every.id)!!.nextAt)
    assertTrue(b.takeDue().isEmpty())
    // A waiting firing's deadline or retry can be sooner.
    b.wait(Waiting(once.id, now, now, false, until = now + 10_000, retryAt = now + 1_000))
    assertEquals(now + 1_000, b.nextAlarm())
    b.wait(Waiting(once.id, now, now, false, until = now + 10_000))
    assertEquals(1, b.waiting().size)
    assertEquals(now + 10_000, b.nextAlarm())
    b.unwait(once.id)
    assertTrue(b.waiting().isEmpty())
    b.ran(once.id, LastRun(now, RunOutcome.WOKE, null))
    assertEquals(RunOutcome.WOKE, book().get(once.id)!!.lastRun!!.outcome)
  }
}
