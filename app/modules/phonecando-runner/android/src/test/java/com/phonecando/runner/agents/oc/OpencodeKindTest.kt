package com.phonecando.runner.agents.oc

import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.agents.LaunchContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.Base64

// JVM checks for the opencode kind: launch recipe, auth and event mapping.
class OpencodeKindTest {
  private val pw = "0123456789abcdef0123456789abcdef"
  private val basic = Base64.getEncoder().encodeToString("opencode:$pw".toByteArray())

  @Test fun launchRunsServeFromTheLibDir() {
    val spec = OpencodeKind.launch(LaunchContext("/lib", File("/home"), "4097", pw))
    assertEquals(
      listOf("/lib/liboc-engine.so", "serve", "--port", "4097", "--hostname", "127.0.0.1"),
      spec.argv,
    )
    assertEquals(pw, spec.env["OPENCODE_SERVER_PASSWORD"])
    assertEquals("/lib/liboc-opentui.so", spec.env["OPENTUI_LIB_PATH"])
  }

  @Test fun probesCarryBasicAuth() {
    val health = OpencodeKind.healthProbe("4100", pw)
    assertEquals("http://127.0.0.1:4100/api/session", health.url)
    assertEquals("Basic $basic", health.headers["Authorization"])
    val events = OpencodeKind.eventStream("4100", pw)
    assertEquals("text/event-stream", events.headers["Accept"])
    assertEquals(listOf(pw, basic), OpencodeKind.passwordForms(pw))
  }

  @Test fun aRenameCarriesTheTitle() {
    val renamed = OpencodeKind.parseEvent("""{"type":"session.renamed","data":{"sessionID":"ses_1","title":"River story"}}""")
    assertEquals(EngineEvent(EngineEvent.Kind.OTHER, "ses_1", title = "River story"), renamed)
    val blank = OpencodeKind.parseEvent("""{"type":"session.renamed","data":{"sessionID":"ses_1","title":" "}}""")
    assertNull(blank?.title)
  }

  @Test fun readsAChatTitle() {
    val info = OpencodeKind.sessionInfo("4100", pw, "ses_1")
    assertEquals("http://127.0.0.1:4100/api/session/ses_1", info.url)
    assertEquals("Basic $basic", info.headers["Authorization"])
    // The device-checked 2.0.26 shape: the session under "data".
    assertEquals("Fix login", OpencodeKind.parseSessionTitle("""{"data":{"id":"ses_1","title":" Fix login "}}"""))
    assertNull(OpencodeKind.parseSessionTitle("""{"data":{"id":"ses_1","title":""}}"""))
    assertNull(OpencodeKind.parseSessionTitle("""{"data":{"id":"ses_1"}}"""))
    assertNull(OpencodeKind.parseSessionTitle("not json"))
  }

  @Test fun parsesV2Frames() {
    val working = OpencodeKind.parseEvent("""{"type":"session.text.delta","data":{"sessionID":"ses_1"}}""")
    assertEquals(EngineEvent(EngineEvent.Kind.WORKING, "ses_1"), working)
    val done = OpencodeKind.parseEvent("""{"type":"session.execution.succeeded","data":{"sessionID":"ses_1"}}""")
    assertEquals(EngineEvent.Kind.FINISHED, done?.kind)
    val created = OpencodeKind.parseEvent("""{"type":"session.created","data":{"sessionID":"ses_2"}}""")
    assertTrue(created!!.sessionCreated)
    val child = OpencodeKind.parseEvent(
      """{"type":"session.created","data":{"sessionID":"ses_3","info":{"parentID":"ses_2"}}}""",
    )
    assertEquals(false, child!!.sessionCreated)
    assertTrue(child.childCreated)
    assertEquals(false, created.childCreated)
    val directChild = OpencodeKind.parseEvent(
      """{"type":"session.created","data":{"sessionID":"ses_4","parentID":"ses_2"}}""",
    )
    assertTrue(directChild!!.childCreated)
    assertEquals(EngineEvent.Kind.OTHER, directChild.kind)
    assertNull(OpencodeKind.parseEvent("not json"))
  }

  @Test fun verdictsAndWaits() {
    fun kind(frame: String) = OpencodeKind.parseEvent(frame)?.kind
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
    val asked = OpencodeKind.parseEvent(
      """{"type":"permission.asked","data":{"id":"per_1","sessionID":"ses_5","action":"bash","resources":[]}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_5"), asked)
    val form = OpencodeKind.parseEvent(
      """{"type":"form.created","data":{"form":{"id":"frm_1","sessionID":"ses_6"}}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_6"), form)
    assertEquals(
      EngineEvent.Kind.WORKING,
      kind("""{"type":"permission.replied","data":{"sessionID":"ses_5","requestID":"per_1","reply":"once"}}"""),
    )
    assertEquals(EngineEvent.Kind.WORKING, kind("""{"type":"form.replied","data":{"id":"frm_1","sessionID":"ses_6"}}"""))
    // v1 envelope.
    val v1 = OpencodeKind.parseEvent(
      """{"payload":{"type":"permission.asked","properties":{"sessionID":"ses_7"}}}""",
    )
    assertEquals(EngineEvent(EngineEvent.Kind.WAITING, "ses_7"), v1)
  }
}
