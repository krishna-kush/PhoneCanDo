package com.phonecando.runner.cutoff

import com.phonecando.runner.cutoff.CutOffLook.Exit
import com.phonecando.runner.cutoff.CutOffLook.Trigger
import com.phonecando.runner.cutoff.CutOffLook.Why
import com.phonecando.runner.engine.EngineMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the look a process makes once: runs an earlier process saw
// going are offered, one offer per agent, with why; a stop you made, a gone
// agent, one running again and a stale run are not.
class CutOffLookTest {
  private val now = 100_000_000L

  private fun run(
    agentId: String = "a1",
    life: String = "old",
    boot: Int? = 7,
    seenAt: Long = now - 60_000,
    chatId: String? = null,
  ) = CutOffRun(agentId, chatId, "fix the build", EngineMode.TERMINAL, seenAt, seenAt, life, boot)

  private fun look(
    runs: List<CutOffRun>,
    bootNow: Int? = 7,
    trigger: Trigger = Trigger.START,
    exit: Exit = Exit.OTHER,
    exists: (String) -> Boolean = { true },
    live: (String) -> Boolean = { false },
  ) = CutOffLook.look(runs, "new", now, bootNow, trigger, exit, exists, live)

  @Test fun whyEachRunStopped() {
    assertEquals(Why.REBOOT, CutOffLook.why(run(boot = 7), 8, Trigger.BOOT, Exit.UNKNOWN))
    assertEquals(Why.UPDATE, CutOffLook.why(run(), 7, Trigger.UPDATE, Exit.USER))
    assertEquals(Why.UPDATE, CutOffLook.why(run(), 7, Trigger.START, Exit.UPDATED))
    assertEquals(Why.CLOSED, CutOffLook.why(run(), 7, Trigger.START, Exit.OTHER))
    assertEquals(Why.CLOSED, CutOffLook.why(run(), null, Trigger.START, Exit.UNKNOWN))
    // You stopped PhoneCanDo yourself: nothing comes back.
    assertNull(CutOffLook.why(run(), 7, Trigger.START, Exit.USER))
    // A rebooted phone tells whatever its last exit says.
    assertEquals(Why.REBOOT, CutOffLook.why(run(), 8, Trigger.START, Exit.USER))
  }

  @Test fun runsAStopKeptOrADeathMarkedSayWhy() {
    assertEquals(Why.DIED, CutOffLook.why(run().copy(diedAt = now), 8, Trigger.BOOT, Exit.USER))
    assertEquals(Why.UPDATE, CutOffLook.why(run().copy(held = Held.UPDATE), 7, Trigger.UPDATE, Exit.USER))
    // A self-update's stop whose update never came: closed, not "updated", and not dropped as yours.
    assertEquals(Why.CLOSED, CutOffLook.why(run().copy(held = Held.UPDATE), 7, Trigger.START, Exit.USER))
    assertEquals(Why.CLOSED, CutOffLook.why(run().copy(held = Held.SYSTEM), 7, Trigger.START, Exit.USER))
  }

  @Test fun oneOfferPerAgentWithWhyFromItsNewestRun() {
    val runs = listOf(
      run(chatId = "s1", seenAt = now - 9_000, boot = 6),
      run(chatId = "s2", seenAt = now - 1_000),
      run(agentId = "a2"),
    )
    val result = look(runs, bootNow = 7)
    assertEquals(runs, result.runs)
    val a1 = result.offers.single { it.agentId == "a1" }
    assertEquals(listOf("s1", "s2"), a1.runs.map { it.chatId })
    assertEquals(Why.CLOSED, a1.why)
    assertEquals(2, result.offers.size)
  }

  @Test fun thisLifeIsNeverOfferedAndAlwaysKept() {
    val mine = run(life = "new")
    val result = look(listOf(mine), exit = Exit.USER)
    assertEquals(listOf(mine), result.runs)
    assertTrue(result.offers.isEmpty())
  }

  @Test fun goneRunningAgainStaleOrStoppedByYouAreDropped() {
    val runs = listOf(
      run(agentId = "gone"),
      run(agentId = "again"),
      run(agentId = "stale", seenAt = now - CutOffLook.MAX_AGE_MS - 1),
      run(agentId = "fresh", seenAt = now - CutOffLook.MAX_AGE_MS + 1),
    )
    val result = look(runs, exists = { it != "gone" }, live = { it == "again" })
    assertEquals(listOf("fresh"), result.runs.map { it.agentId })
    assertEquals(listOf("fresh"), result.offers.map { it.agentId })
    val yours = look(listOf(run()), exit = Exit.USER)
    assertTrue(yours.runs.isEmpty() && yours.offers.isEmpty())
  }

  @Test fun aChatLeftShowingWorkingWithNoWorkBehindItIsStale() {
    // The agent's last sign of work came hours before this process last looked at the run.
    val stuck = run(seenAt = now - 8 * 60 * 60_000L).copy(checkedAt = now - 60_000)
    val quiet = run(agentId = "a2", seenAt = now - CutOffLook.STALE_MS).copy(checkedAt = now)
    val result = look(listOf(stuck, quiet))
    assertEquals(listOf("a2"), result.offers.map { it.agentId })
    assertEquals(listOf(quiet), result.runs)
    assertTrue(CutOffLook.stale(stuck))
    // Offered at once in this life: the same.
    val died = stuck.copy(life = "new", diedAt = now)
    assertNull(CutOffLook.offerNow(listOf(died), "a1", "new"))
  }

  @Test fun aDeathKeepsItsRunWhileItsLastSightIsFresh() {
    val died = run(seenAt = now - CutOffLook.MAX_AGE_MS - 10).copy(diedAt = now - 1_000)
    assertEquals(Why.DIED, look(listOf(died)).offers.single().why)
  }

  @Test fun offeredAtOnceInThisLife() {
    val runs = listOf(
      run(life = "new").copy(diedAt = now),
      run(life = "new", chatId = "kept").copy(held = Held.SYSTEM),
      run(life = "new", agentId = "a2").copy(held = Held.SYSTEM),
      run(life = "new", agentId = "a3"),
    )
    val a1 = CutOffLook.offerNow(runs, "a1", "new")!!
    assertEquals(Why.DIED, a1.why)
    assertEquals(2, a1.runs.size)
    assertEquals(Why.CLOSED, CutOffLook.offerNow(runs, "a2", "new")!!.why)
    assertNull(CutOffLook.offerNow(runs, "a3", "new"))
  }
}
