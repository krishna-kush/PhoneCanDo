package com.phonecando.runner.checks.now

import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.acp.AcpOption
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// When Check now refuses (first match wins), its parts and its task.
class CheckNowRulesTest {
  private val free = CheckNowRules.Look(
    prompts = true,
    acp = false,
    checking = false,
    installing = false,
    notInstalled = false,
    busy = false,
  )

  @Test fun aFreeAgentMayStart() {
    assertNull(CheckNowRules.refusal(free))
    assertNull(CheckNowRules.refusal(free.copy(prompts = false, acp = true)))
  }

  @Test fun aKindWithNeitherPromptNorAcpCantAtAll() {
    val cant = free.copy(prompts = false, acp = false)
    assertEquals(CheckNowRules.CANT, CheckNowRules.refusal(cant))
    // Ahead of everything else.
    assertEquals(CheckNowRules.CANT, CheckNowRules.refusal(cant.copy(checking = true, busy = true)))
    assertEquals(CheckNowRules.CANT, CheckNowRules.kindRefusal(prompts = false, acp = false))
    assertNull(CheckNowRules.kindRefusal(prompts = true, acp = false))
    assertNull(CheckNowRules.kindRefusal(prompts = false, acp = true))
  }

  @Test fun eachRefusalInItsOrder() {
    val all = free.copy(checking = true, installing = true, notInstalled = true, busy = true)
    assertEquals(CheckNowRules.CHECKING, CheckNowRules.refusal(all))
    assertEquals(CheckNowRules.INSTALLING, CheckNowRules.refusal(all.copy(checking = false)))
    assertEquals(CheckNowRules.NOT_INSTALLED, CheckNowRules.refusal(all.copy(checking = false, installing = false)))
    assertEquals(CheckNowRules.BUSY, CheckNowRules.refusal(free.copy(busy = true)))
  }

  private val task = CheckNowRules.TASK

  // Everything a kind could declare, by wire id.
  private val all = setOf("tools", "messages", "wake", "task", "state", "acp", "acpTools", "acpMessages", "chat")

  @Test fun oneTaskThatAsksForNoTools() {
    assertEquals("PhoneCanDo check: reply with just the word done. Don't use any tools.", CheckNowRules.TASK)
  }

  @Test fun aKindWithoutAcpRunsOnePartInItsOwnAppInANewChat() {
    assertEquals(
      CheckPlan(listOf(CheckPlan.Part(EngineMode.TERMINAL, task, newChat = true, tests = listOf("tools", "messages", "wake", "task", "state")))),
      CheckNowRules.plan(prompts = true, acp = false, opensChat = false, declared = all - setOf("acp", "acpTools", "acpMessages", "chat")),
    )
    assertNull(CheckNowRules.plan(prompts = false, acp = false, opensChat = false, declared = all))
  }

  @Test fun acpFirstThenItsOwnAppOnTheSameChatWithTheTask() {
    assertEquals(
      CheckPlan(
        listOf(
          CheckPlan.Part(EngineMode.ACP, task, newChat = true, tests = listOf("state", "acp", "acpTools", "acpMessages"), holdsChat = true),
          CheckPlan.Part(EngineMode.TERMINAL, task, newChat = false, tests = listOf("tools", "messages", "wake", "task", "chat")),
        ),
      ),
      CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = all),
    )
  }

  @Test fun checkTheRestLeavesOutWhatIsChecked() {
    // The ACP rows checked, chat not: part 1 runs only to open the chat part 2 tests.
    assertEquals(
      CheckPlan(
        listOf(
          CheckPlan.Part(EngineMode.ACP, task, newChat = true, tests = emptyList(), holdsChat = true),
          CheckPlan.Part(EngineMode.TERMINAL, task, newChat = false, tests = listOf("wake", "chat")),
        ),
      ),
      CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = all, done = all - setOf("wake", "chat")),
    )
    // Only its own app's rows left and chat checked: no ACP part, and a new chat, never your last one.
    assertEquals(
      CheckPlan(listOf(CheckPlan.Part(EngineMode.TERMINAL, task, newChat = true, tests = listOf("wake")))),
      CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = all, done = all - "wake"),
    )
    // Only an ACP row left: one part.
    assertEquals(
      CheckPlan(listOf(CheckPlan.Part(EngineMode.ACP, task, newChat = true, tests = listOf("acpMessages")))),
      CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = all, done = all - "acpMessages"),
    )
    // Nothing it can test is left: everything checked, or only what needs a turn it can't start.
    assertNull(CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = all, done = all))
    assertNull(CheckNowRules.plan(prompts = false, acp = true, opensChat = true, declared = all - "task", done = all - setOf("messages", "wake")))
  }

  @Test fun onlyDeclaredCapabilitiesAreTested() {
    val plan = CheckNowRules.plan(prompts = true, acp = true, opensChat = true, declared = setOf("acp", "task", "chat"))
    assertEquals(listOf("acp"), plan?.parts?.get(0)?.tests)
    assertEquals(listOf("task", "chat"), plan?.parts?.get(1)?.tests)
  }

  @Test fun aSecondPartWithNoPromptOnlyOpensTheChatAndSkipsWhatNeedsATurn() {
    val plan = CheckNowRules.plan(prompts = false, acp = true, opensChat = true, declared = all - "task")
    assertEquals(
      CheckPlan.Part(EngineMode.TERMINAL, null, newChat = false, tests = listOf("tools", "chat"), skips = listOf("messages", "wake")),
      plan?.parts?.get(1),
    )
  }

  @Test fun aSecondPartThatCantOpenTheChatTakesANewOne() {
    val plan = CheckNowRules.plan(prompts = true, acp = true, opensChat = false, declared = all - "chat")
    assertEquals(
      CheckPlan.Part(EngineMode.TERMINAL, task, newChat = true, tests = listOf("tools", "messages", "wake", "task")),
      plan?.parts?.get(1),
    )
  }

  @Test fun acpAloneIsOnePart() {
    assertEquals(
      CheckPlan(listOf(CheckPlan.Part(EngineMode.ACP, task, newChat = true, tests = listOf("acp", "acpTools")))),
      CheckNowRules.plan(prompts = false, acp = true, opensChat = false, declared = setOf("tools", "acp", "acpTools")),
    )
  }

  @Test fun partsCountsThemOrZero() {
    assertEquals(2, CheckNowRules.parts(prompts = true, acp = true, opensChat = false))
    assertEquals(2, CheckNowRules.parts(prompts = false, acp = true, opensChat = true))
    assertEquals(1, CheckNowRules.parts(prompts = false, acp = true, opensChat = false))
    assertEquals(1, CheckNowRules.parts(prompts = true, acp = false, opensChat = false))
    assertEquals(0, CheckNowRules.parts(prompts = false, acp = false, opensChat = false))
  }

  @Test fun aPermissionQuestionDuringACheckIsRejected() {
    val once = AcpOption("o1", "No", "reject_once")
    val always = AcpOption("o2", "Never", "reject_always")
    val allow = AcpOption("o3", "Yes", "allow_once")
    assertEquals("o1", CheckNowRules.rejectOption(listOf(allow, always, once)))
    assertEquals("o2", CheckNowRules.rejectOption(listOf(allow, always)))
    // No way to reject: cancelled.
    assertNull(CheckNowRules.rejectOption(listOf(allow)))
  }
}
