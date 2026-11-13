package com.phonecando.runner.messages.delivery

import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.InboxRequest
import com.phonecando.runner.messages.agent
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

// The inbox folder as the kit script reads it (pending/ with ids,
// messages.jsonl, messages.txt, <Event>.out, <Event>.exit and wake, swapped
// whole), what an engine start cleans, a claim found before its receipt,
// and a server engine's deliver and wake calls.
class InboxCourierTest {
  private val home = Files.createTempDirectory("inbox").toFile()
  private val b = agent("b", "Tester")
  private val folder = InboxFolder.of(home, "b")

  @After fun cleanup() {
    home.deleteRecursively()
  }

  private class Plan(
    override val hooks: Map<String, Int> = emptyMap(),
    override val reader: Boolean = false,
    override val server: Boolean = false,
    override val wakesByServer: Boolean = false,
  ) : InboxPlan {
    override fun hookOutput(event: String, text: String) = "[$event] $text"

    override fun request(call: InboxCall, port: String, password: String, sessionId: String, text: String): InboxRequest? =
      if (sessionId.isBlank()) null else InboxRequest("http://127.0.0.1:$port/$call/$sessionId", mapOf("pw" to password), "POST", text)
  }

  private val parcel = Parcel(listOf(3, 4), "two messages", "{\"id\":3}\n{\"id\":4}\n", wake = true)

  private fun courier(plan: InboxPlan?, seat: ServerSeat? = null, post: (InboxRequest) -> Int = { 200 }) =
    InboxCourier({ plan }, { folder }, { seat }, post)

  @Test fun hooksGetTheWholeSetInPending() {
    val c = courier(Plan(hooks = mapOf("PostToolUse" to 0, "Stop" to 2, "bad/name" to 0)))
    assertEquals(Handover.HELD, c.handOver(b, parcel))
    val pending = File(home, ".phonecando/inbox-b/pending")
    assertEquals("3\n4\n", File(pending, "ids").readText())
    assertEquals(parcel.jsonl, File(pending, "messages.jsonl").readText())
    assertEquals("two messages", File(pending, "messages.txt").readText())
    assertEquals("[PostToolUse] two messages", File(pending, "PostToolUse.out").readText())
    assertEquals("[Stop] two messages", File(pending, "Stop.out").readText())
    assertEquals("2\n", File(pending, "Stop.exit").readText())
    assertFalse(File(pending, "PostToolUse.exit").exists())
    assertTrue(File(pending, "wake").exists())
    assertEquals(
      setOf("ids", "messages.jsonl", "messages.txt", "PostToolUse.out", "Stop.out", "Stop.exit", "wake"),
      pending.list()!!.toSet(),
    )
    // A new set replaces it whole; without the wake mark when it may not wake.
    c.handOver(b, parcel.copy(ids = listOf(4), wake = false))
    assertEquals("4\n", File(pending, "ids").readText())
    assertFalse(File(pending, "wake").exists())
    // Only pending/ is ours: the script's waiter file stays.
    assertEquals(setOf("pending"), File(home, ".phonecando/inbox-b").list()!!.toSet())
    c.clear(b)
    assertFalse(pending.exists())
  }

  @Test fun aClaimBeforeItsReceiptIsFound() {
    val c = courier(Plan(hooks = mapOf("Stop" to 0)))
    c.handOver(b, parcel)
    assertTrue(c.claimed(b).isEmpty())
    // The hook renames pending/ away: those ids are in its turn.
    val claimed = File(home, ".phonecando/inbox-b/claimed.123")
    assertTrue(folder.pending.renameTo(claimed))
    assertEquals(setOf(3L, 4L), c.claimed(b))
    // Still in flight while its folder is there; gone with it.
    assertEquals(setOf(3L, 4L), c.claimed(b))
    claimed.deleteRecursively()
    assertTrue(c.claimed(b).isEmpty())
  }

  @Test fun anEngineStartCleansWhatAnEarlierLifeLeft() {
    val dir = File(home, ".phonecando/inbox-b")
    File(dir, "claimed.99").mkdirs()
    File(dir, ".pending-next.5").mkdirs()
    File(dir, "waiter").apply { parentFile.mkdirs() }.writeText("42\n")
    // A link in a claimed folder is removed, never followed.
    val outside = File(home, "keep.txt").apply { writeText("keep") }
    Files.createSymbolicLink(File(dir, "claimed.99/link").toPath(), home.toPath())
    folder.prepare()
    // The earlier life's waiter went with its engine: none waits for the new one.
    assertEquals(emptySet<String>(), dir.list()!!.toSet())
    assertEquals("keep", outside.readText())
  }

  @Test fun aReaderKindGetsTheFolderToo() {
    assertEquals(Handover.HELD, courier(Plan(reader = true)).handOver(b, parcel))
    assertTrue(File(folder.pending, "messages.jsonl").exists())
    assertNull(File(folder.pending, "Stop.out").takeIf { it.exists() })
  }

  @Test fun aPullOnlyKindGetsNothing() {
    assertEquals(Handover.NONE, courier(null).handOver(b, parcel))
    assertFalse(folder.pending.exists())
  }

  @Test fun aServerTakesThemIntoItsChat() {
    val posted = ArrayList<InboxRequest>()
    val seat = ServerSeat("4096", "pw-b", "ses_1")
    val deliverOnly = courier(Plan(server = true), seat) { posted += it; 200 }
    assertEquals(Handover.POSTED, deliverOnly.handOver(b, parcel))
    assertEquals("http://127.0.0.1:4096/DELIVER/ses_1", posted.last().url)
    assertEquals("two messages", posted.last().body)
    val wakes = courier(Plan(server = true, wakesByServer = true), seat) { posted += it; 204 }
    assertEquals(Handover.WOKE, wakes.handOver(b, parcel))
    assertEquals("http://127.0.0.1:4096/WAKE/ses_1", posted.last().url)
    assertEquals(Handover.POSTED, wakes.handOver(b, parcel.copy(wake = false)))
    assertFalse(folder.pending.exists())
  }

  @Test fun noKnownChatAsksTheEngineForItsNewest() {
    val plan = object : InboxPlan {
      override val hooks: Map<String, Int> = emptyMap()
      override val reader = false
      override val server = true
      override val wakesByServer = true

      override fun hookOutput(event: String, text: String) = text

      override fun request(call: InboxCall, port: String, password: String, sessionId: String, text: String) =
        InboxRequest("http://127.0.0.1:$port/$call/$sessionId", emptyMap(), "POST", text)

      override fun latestRequest(port: String, password: String) = InboxRequest("http://127.0.0.1:$port/sessions", emptyMap(), "GET", "")

      override fun latestId(answer: String) = Regex("\"id\":\"([^\"]+)\"").find(answer)?.groupValues?.get(1)
    }
    val posted = ArrayList<String>()
    val courier = InboxCourier(
      { plan }, { folder }, { ServerSeat("4096", "pw", null) }, { posted += it.url; 200 },
      fetch = { 200 to "{\"data\":[{\"id\":\"ses_newest\"}]}" },
    )
    assertEquals(Handover.WOKE, courier.handOver(b, parcel))
    assertEquals(listOf("http://127.0.0.1:4096/WAKE/ses_newest"), posted)
    // The engine lists none: still queued.
    val empty = InboxCourier({ plan }, { folder }, { ServerSeat("4096", "pw", null) }, { 200 }, fetch = { 200 to "{\"data\":[]}" })
    assertEquals(Handover.NONE, empty.handOver(b, parcel))
  }

  @Test fun aScheduledTaskForANewChatWakesAChatMadeForItOnce() {
    val plan = object : InboxPlan {
      override val hooks: Map<String, Int> = emptyMap()
      override val reader = false
      override val server = true
      override val wakesByServer = true

      override fun hookOutput(event: String, text: String) = text

      override fun request(call: InboxCall, port: String, password: String, sessionId: String, text: String) =
        InboxRequest("http://127.0.0.1:$port/$call/$sessionId", emptyMap(), "POST", text)

      override fun createRequest(port: String, password: String, title: String) =
        InboxRequest("http://127.0.0.1:$port/session", emptyMap(), "POST", title)

      override fun createdId(answer: String) = Regex("\"id\":\"([^\"]+)\"").find(answer)?.groupValues?.get(1)
    }
    val posted = ArrayList<String>()
    val made = ArrayList<String>()
    var status = 500
    val courier = InboxCourier(
      { plan }, { folder }, { ServerSeat("4096", "pw", "ses_current") }, { posted += it.url; status },
      fetch = { made += it.body; 200 to "{\"id\":\"ses_new${made.size}\"}" },
    )
    val task = parcel.copy(newChat = "Scheduled: check CI")
    assertEquals(Handover.NONE, courier.handOver(b, task))
    // The post failed: the retry wakes the chat already made, not a second one.
    status = 200
    assertEquals(Handover.WOKE, courier.handOver(b, task))
    assertEquals(listOf("Scheduled: check CI"), made)
    assertEquals(listOf("http://127.0.0.1:4096/WAKE/ses_new1", "http://127.0.0.1:4096/WAKE/ses_new1"), posted)
    // Not waking: no chat is made, it goes to the current one.
    assertEquals(Handover.POSTED, courier.handOver(b, task.copy(ids = listOf(9), wake = false)))
    assertEquals("http://127.0.0.1:4096/DELIVER/ses_current", posted.last())
    // A kind that makes no chats wakes the current one.
    val plain = InboxCourier({ Plan(server = true, wakesByServer = true) }, { folder }, { ServerSeat("4096", "pw", "ses_current") }, { posted += it.url; 200 })
    assertEquals(Handover.WOKE, plain.handOver(b, task))
    assertEquals("http://127.0.0.1:4096/WAKE/ses_current", posted.last())
  }

  @Test fun noChatOrAFailureKeepsThemQueued() {
    var now = 0L
    var calls = 0
    val noChat = InboxCourier({ Plan(server = true) }, { folder }, { ServerSeat("1", "pw", null) }, { calls++; 200 }, { now })
    assertEquals(Handover.NONE, noChat.handOver(b, parcel))
    assertEquals(0, calls)
    val failing = InboxCourier({ Plan(server = true) }, { folder }, { ServerSeat("1", "pw", "s") }, { calls++; 500 }, { now })
    assertEquals(Handover.NONE, failing.handOver(b, parcel))
    assertEquals(1, calls)
    // A retry waits after a failure; a new message does not.
    assertEquals(Handover.NONE, failing.handOver(b, parcel, retry = true))
    assertEquals(1, calls)
    failing.handOver(b, parcel)
    assertEquals(2, calls)
    now += InboxCourier.RETRY_MS
    failing.handOver(b, parcel, retry = true)
    assertEquals(3, calls)
    val throwing = InboxCourier({ Plan(server = true) }, { folder }, { ServerSeat("1", "pw", "s") }, { throw java.io.IOException("refused") })
    assertEquals(Handover.NONE, throwing.handOver(b, parcel))
  }
}
