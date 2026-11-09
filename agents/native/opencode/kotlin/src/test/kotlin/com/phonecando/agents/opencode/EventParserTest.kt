package com.phonecando.agents.opencode

import com.phonecando.agents.kit.EngineEvent
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for opencode's event frames, through the hook the manifest names.
class EventParserTest {
  private val parser = checkNotNull(OpencodeHooks.sseParser(OpencodeHooks.EVENTS))

  private fun parse(frame: String) = parser(frame)

  @Test fun onlyItsOwnHookName() {
    assertNull(OpencodeHooks.sseParser("other.events"))
  }

  @Test fun aRenameCarriesTheTitle() {
    val renamed = parse("""{"type":"session.renamed","data":{"sessionID":"ses_1","title":"River story"}}""")
    assertEquals(EngineEvent(EngineEvent.Kind.OTHER, "ses_1", title = "River story"), renamed)
    val blank = parse("""{"type":"session.renamed","data":{"sessionID":"ses_1","title":" "}}""")
    assertNull(blank?.title)
  }

  @Test fun parsesV2Frames() {
    val working = parse("""{"type":"session.text.delta","data":{"sessionID":"ses_1"}}""")
    assertEquals(EngineEvent(EngineEvent.Kind.WORKING, "ses_1"), working)
    val done = parse("""{"type":"session.execution.succeeded","data":{"sessionID":"ses_1"}}""")
    assertEquals(EngineEvent.Kind.FINISHED, done?.kind)
    val created = parse("""{"type":"session.created","data":{"sessionID":"ses_2"}}""")
    assertTrue(created!!.sessionCreated)
    val child = parse(
      """{"type":"session.created","data":{"sessionID":"ses_3","info":{"parentID":"ses_2"}}}""",
    )
    assertEquals(false, child!!.sessionCreated)
    assertTrue(child.childCreated)
    assertEquals(false, created.childCreated)
    val directChild = parse(
      """{"type":"session.created","data":{"sessionID":"ses_4","parentID":"ses_2"}}""",
    )
    assertTrue(directChild!!.childCreated)
    assertEquals(EngineEvent.Kind.OTHER, directChild.kind)
    assertNull(parse("not json"))
  }

  @Test fun verdictsAndWaits() {
    fun kind(frame: String) = parse(frame)?.kind
    assertEquals(
      EngineEvent.Kind.FAILED,
      kind("""{"type":"session.execution.failed","data":{"sessionID":"ses_1","error":{}}}"""),
    )
    assertEquals(EngineEvent.Kind.FAILED, kind("""{"type":"session.error","data":{"sessionID":"ses_1"}}"""))
    // A failed step may be retried: the run's verdict comes later.
    assertEquals(
      EngineEvent.Kind.WORKING,
      kind("""{"type":"session.step.failed","data":{"sessionID":"ses_1"}}"""),
    )
    // The user's own stop ends the run with no verdict.
    assertEquals(
      EngineEvent.Kind.STOPPED,
      kind("""{"type":"session.execution.interrupted","data":{"sessionID":"ses_1","reason":"user"}}"""),
    )
    val asked = parse(
      """{"type":"permission.asked","data":{"id":"per_1","sessionID":"ses_5","action":"bash","resources":[]}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_5"), asked)
    val form = parse(
      """{"type":"form.created","data":{"form":{"id":"frm_1","sessionID":"ses_6"}}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_6"), form)
    assertEquals(
      EngineEvent.Kind.WORKING,
      kind("""{"type":"permission.replied","data":{"sessionID":"ses_5","requestID":"per_1","reply":"once"}}"""),
    )
    assertEquals(EngineEvent.Kind.WORKING, kind("""{"type":"form.replied","data":{"id":"frm_1","sessionID":"ses_6"}}"""))
    // v1 envelope.
    val v1 = parse(
      """{"payload":{"type":"permission.asked","properties":{"sessionID":"ses_7"}}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_7"), v1)
  }
}
