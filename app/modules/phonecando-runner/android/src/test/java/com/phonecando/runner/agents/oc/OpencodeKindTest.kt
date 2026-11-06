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
    assertNull(OpencodeKind.parseEvent("not json"))
  }
}
