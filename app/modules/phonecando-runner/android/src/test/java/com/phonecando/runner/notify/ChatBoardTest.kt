package com.phonecando.runner.notify

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.EngineEvent.Kind
import com.phonecando.runner.notify.ChatBoard.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The chats the service notification lists, for several agents at once.
class ChatBoardTest {
  private val board = ChatBoard(maxEnded = 2, maxChildren = 2)
  private var now = 0L

  private fun on(agent: String, kind: Kind, session: String?, child: Boolean = false) =
    board.onEvent(agent, EngineEvent(kind, session, childCreated = child), ++now)

  private fun shown() = board.chats().map { "${it.agentId}/${it.sessionId}/${it.state}" }

  @Test fun aChatShowsItsRunAndEnds() {
    assertEquals(ChatBoard.Change(true, "s1"), on("a", Kind.WORKING, "s1"))
    assertEquals(listOf("a/s1/WORKING"), shown())
    assertEquals(ChatBoard.Change(false), on("a", Kind.WORKING, "s1"))
    assertEquals(ChatBoard.Change(true, null), on("a", Kind.WAITING, "s1"))
    // Answered: back to work, no new title read.
    assertEquals(ChatBoard.Change(true, null), on("a", Kind.WORKING, "s1"))
    // Done reads the final title.
    assertEquals(ChatBoard.Change(true, "s1"), on("a", Kind.FINISHED, "s1"))
    assertEquals(listOf("a/s1/DONE"), shown())
    // A new run in the same chat reads the title again.
    assertEquals(ChatBoard.Change(true, "s1"), on("a", Kind.WORKING, "s1"))
  }

  @Test fun eachAgentsLatestChatAndItsChatsForMessages() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.FINISHED, "s2")
    on("a", Kind.OTHER, "s9")
    assertEquals("s2", board.latest("a"))
    // A subagent's child never is.
    on("a", Kind.WORKING, "kid", child = true)
    on("a", Kind.WAITING, "kid")
    assertEquals("s2", board.latest("a"))
    // The chat on screen still counts for the agent's own list.
    board.setOpen("a", "s1")
    assertEquals(listOf("kid", "s2", "s1"), board.of("a").map { it.sessionId })
    on("a", Kind.GONE, "s2")
    assertNull(board.latest("a"))
    on("a", Kind.WORKING, "s1")
    assertEquals("s1", board.latest("a"))
    board.drop("a")
    assertNull(board.latest("a"))
    assertTrue(board.of("a").isEmpty())
  }

  @Test fun workingCountsTheChatOnScreenToo() {
    on("a", Kind.WORKING, "s1")
    on("b", Kind.WAITING, "s2")
    on("c", Kind.FINISHED, "s3")
    board.setOpen("a", "s1")
    assertEquals(setOf("a"), board.working())
    on("a", Kind.FINISHED, "s1")
    assertEquals(emptySet<String>(), board.working())
  }

  @Test fun busyWhileAChatWorksOrWaitsForAnAnswer() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.WORKING, "s2")
    on("a", Kind.FINISHED, "s1")
    assertTrue(board.busy("a"))
    on("a", Kind.WAITING, "s2")
    assertTrue(board.busy("a"))
    on("a", Kind.STOPPED, "s2")
    assertFalse(board.busy("a"))
    // A subagent's verdict leaves its parent's run going.
    on("b", Kind.WORKING, "p")
    on("b", Kind.OTHER, "c", child = true)
    on("b", Kind.FINISHED, "c")
    assertTrue(board.busy("b"))
    assertFalse(board.busy("x"))
  }

  @Test fun orderIsWaitingWorkingErrorDoneNewestFirst() {
    on("a", Kind.WORKING, "s1")
    on("b", Kind.FINISHED, "s2")
    on("a", Kind.FAILED, "s3")
    on("b", Kind.WORKING, "s4")
    on("b", Kind.WAITING, "s5")
    assertEquals(listOf("b/s5/WAITING", "b/s4/WORKING", "a/s1/WORKING", "a/s3/FAILED", "b/s2/DONE"), shown())
  }

  @Test fun stoppedAndDeletedChatsLeave() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.WORKING, "s2")
    assertTrue(on("a", Kind.STOPPED, "s1").changed)
    assertTrue(on("a", Kind.GONE, "s2").changed)
    assertEquals(emptyList<String>(), shown())
    assertFalse(on("a", Kind.STOPPED, "s9").changed)
  }

  @Test fun otherAndSessionlessEventsChangeNothing() {
    assertFalse(on("a", Kind.OTHER, "s1").changed)
    assertFalse(on("a", Kind.WORKING, null).changed)
    assertEquals(emptyList<String>(), shown())
  }

  @Test fun aChildShowsOnlyWhileItWaits() {
    on("a", Kind.WORKING, "p")
    on("a", Kind.OTHER, "c", child = true)
    assertFalse(on("a", Kind.WORKING, "c").changed)
    assertTrue(on("a", Kind.WAITING, "c").changed)
    assertEquals(listOf("a/c/WAITING", "a/p/WORKING"), shown())
    // Answered: the child's work is the parent's run again.
    assertTrue(on("a", Kind.WORKING, "c").changed)
    assertFalse(on("a", Kind.FINISHED, "c").changed)
    assertEquals(listOf("a/p/WORKING"), shown())
  }

  @Test fun endedChatsAreCappedOldestFirst() {
    on("a", Kind.FINISHED, "s1")
    on("a", Kind.FAILED, "s2")
    on("b", Kind.FINISHED, "s3")
    on("b", Kind.WORKING, "s4")
    assertEquals(listOf("b/s4/WORKING", "a/s2/FAILED", "b/s3/DONE"), shown())
  }

  @Test fun seenDropsOnlyThatAgentsEndedChats() {
    on("a", Kind.FINISHED, "s1")
    on("a", Kind.WORKING, "s2")
    on("b", Kind.FINISHED, "s3")
    assertTrue(board.seen("a"))
    assertEquals(listOf("a/s2/WORKING", "b/s3/DONE"), shown())
    assertFalse(board.seen("a"))
  }

  @Test fun anEngineGoneTakesItsChats() {
    on("a", Kind.WORKING, "s1")
    on("b", Kind.WORKING, "s2")
    assertTrue(board.drop("a"))
    assertEquals(listOf("b/s2/WORKING"), shown())
    assertFalse(board.drop("a"))
  }

  @Test fun theOpenChatIsLeftOutUntilYouLeave() {
    on("a", Kind.WORKING, "s1")
    on("b", Kind.WORKING, "s2")
    assertTrue(board.setOpen("a", "s1"))
    assertFalse(board.setOpen("a", "s1"))
    assertEquals(listOf("b/s2/WORKING"), shown())
    on("a", Kind.WAITING, "s1")
    assertEquals(listOf("b/s2/WORKING"), shown())
    assertTrue(board.setOpen(null, null))
    assertEquals(listOf("a/s1/WAITING", "b/s2/WORKING"), shown())
  }

  @Test fun aRunThatEndsWhileOpenIsSeen() {
    on("a", Kind.WORKING, "s1")
    board.setOpen("a", "s1")
    assertFalse(on("a", Kind.FINISHED, "s1").changed)
    board.setOpen("a", "other")
    assertEquals(emptyList<String>(), shown())
    // The next run in that chat shows again once you have left it.
    on("a", Kind.WORKING, "s1")
    assertEquals(listOf("a/s1/WORKING"), shown())
  }

  @Test fun openingAnEndedChatSeesIt() {
    on("a", Kind.FAILED, "s1")
    on("a", Kind.FINISHED, "s2")
    board.setOpen("a", "s1")
    board.setOpen(null, null)
    assertEquals(listOf("a/s2/DONE"), shown())
  }

  @Test fun aTuiNamesItsChatByTitle() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.WORKING, "s2")
    on("b", Kind.WORKING, "s3")
    board.setTitle("a", "s1", "Fix login")
    board.setTitle("a", "s2", "Refactor the payment service retries and timeouts")
    board.setTitle("b", "s3", "Fix login")
    // Exact title: that agent's chat only.
    board.setOpen("a", null, "Fix login")
    assertEquals(listOf("a/s2/WORKING", "b/s3/WORKING"), shown().sortedBy { it })
    // Cut to 37 characters and "…".
    board.setOpen("a", null, "Refactor the payment service retries …")
    assertEquals(listOf("a/s1/WORKING", "b/s3/WORKING"), shown().sortedBy { it })
    // A finish there is seen.
    on("a", Kind.FINISHED, "s2")
    board.setOpen(null, null)
    assertEquals(listOf("a/s1/WORKING", "b/s3/WORKING"), shown().sortedBy { it })
  }

  @Test fun anUnknownOrSharedTitleHidesNothing() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.WORKING, "s2")
    board.setTitle("a", "s1", "Same")
    board.setTitle("a", "s2", "Same")
    board.setOpen("a", null, "Same")
    assertEquals(2, board.chats().size)
    board.setOpen("a", null, "Nothing like it")
    assertEquals(2, board.chats().size)
    // A chat whose title arrives later is hidden once it fits.
    on("a", Kind.WORKING, "s9")
    board.setOpen("a", null, "Late title")
    assertEquals(3, board.chats().size)
    assertTrue(board.setTitle("a", "s9", "Late title"))
    assertEquals(2, board.chats().size)
  }

  @Test fun aRenameNamesTheChatAndATuiCanThenSeeIt() {
    on("a", Kind.WORKING, "s1")
    on("a", Kind.FINISHED, "s1")
    // The TUI already shows the new name; the board does not know it yet.
    board.setOpen("a", null, "River story")
    assertEquals(listOf("a/s1/DONE"), shown())
    assertEquals(listOf("a" to "s1"), board.titlesToReread())
    // The rename arrives: the chat is the open one, and done, so seen.
    val renamed = board.onEvent("a", EngineEvent(Kind.OTHER, "s1", title = "River story"), ++now)
    assertTrue(renamed.changed)
    assertEquals(emptyList<String>(), shown())
    assertEquals(emptyList<Pair<String, String>>(), board.titlesToReread())
  }

  @Test fun titlesFillInAndChangeOnlyWhenNew() {
    on("a", Kind.WORKING, "s1")
    assertNull(board.chats().single().title)
    assertTrue(board.setTitle("a", "s1", "Fix login"))
    assertFalse(board.setTitle("a", "s1", "Fix login"))
    assertFalse(board.setTitle("a", "s1", " "))
    assertFalse(board.setTitle("a", "s9", "Nope"))
    on("a", Kind.FINISHED, "s1")
    assertEquals("Fix login", board.chats().single().title)
    assertEquals(State.DONE, board.chats().single().state)
  }
}
