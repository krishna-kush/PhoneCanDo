package com.phonecando.runner.models.chats

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class ChatSwitchTest {
  @get:Rule val tmp = TemporaryFolder()

  private val calls = mutableListOf<String>()
  private var saves = true
  private var restores = true
  private var failing = 0

  private fun switch(): Pair<ChatSwitch, ChatFiles> {
    val files = ChatFiles(File(tmp.root, ".chats"), 1, { Long.MAX_VALUE })
    files.prepare("s")
    val save = { name: String ->
      calls += "save $name"
      if (saves) File(files.dir, name).writeBytes(ByteArray(1))
      saves
    }
    val restore = { name: String -> calls += "restore $name"; restores }
    return ChatSwitch(files, save, restore, onFailing = { failing++ }) to files
  }

  private fun ChatSwitch.turn(key: String?) {
    assertTrue(acquire { false })
    try {
      switchTo(key)
    } finally {
      release()
    }
  }

  @Test fun chatsTakingTurnsAreSavedAndLoadedBack() {
    val (s, files) = switch()
    s.turn("a")
    s.turn("a")
    assertEquals(emptyList<String>(), calls)
    s.turn("b")
    assertEquals(listOf("save a.tmp"), calls)
    assertTrue(files.has("a"))
    s.turn("a")
    assertEquals(listOf("save a.tmp", "save b.tmp", "restore a.bin"), calls)
    assertEquals("a", s.live())
  }

  @Test fun aRequestWeCannotNameSavesTheLiveChatAndHoldsNoName() {
    val (s, _) = switch()
    s.turn("a")
    s.turn(null)
    assertNull(s.live())
    // What it left on the slot has no name to save under.
    s.turn("b")
    assertEquals(listOf("save a.tmp"), calls)
  }

  @Test fun aFileTheServerWouldNotLoadGoesAndTheRequestRunsAnyway() {
    val (s, files) = switch()
    s.turn("a")
    s.turn("b")
    restores = false
    s.turn("a")
    assertFalse(files.has("a"))
    assertEquals("a", s.live())
  }

  @Test fun savesThatKeepFailingStopForThisRun() {
    val (s, files) = switch()
    saves = false
    for (key in listOf("a", "b", "c", "d", "e")) s.turn(key)
    assertEquals(1, failing)
    assertEquals(ChatSwitch.MAX_FAILED_SAVES, calls.count { it.startsWith("save") })
    assertTrue(files.saved().isEmpty())
  }

  @Test fun beforeAStopTheLiveChatIsSavedWhenTheSlotIsFree() {
    val (s, files) = switch()
    s.turn("a")
    s.saveBeforeStop(100)
    assertTrue(files.has("a"))
    // Held by a request: no wait past the time given, nothing saved.
    s.turn("b")
    val held = CountDownLatch(1)
    val done = CountDownLatch(1)
    thread {
      s.acquire { false }
      held.countDown()
      done.await()
      s.release()
    }
    held.await(2, TimeUnit.SECONDS)
    s.saveBeforeStop(50)
    assertFalse(files.has("b"))
    done.countDown()
  }

  @Test fun oneRequestAtATimeAndAWaiterThatLeftGivesUp() {
    val (s, _) = switch()
    assertTrue(s.acquire { false })
    var asked = 0
    val gotIt = CountDownLatch(1)
    thread {
      if (s.acquire { ++asked >= 2 }) gotIt.countDown()
    }
    Thread.sleep(800)
    assertEquals(1L, gotIt.count)
    assertTrue(asked >= 2)
    s.release()
  }
}
