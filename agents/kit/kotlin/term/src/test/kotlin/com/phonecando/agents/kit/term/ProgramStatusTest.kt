package com.phonecando.agents.kit.term

import org.junit.jupiter.api.Test
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertNull

// JVM checks for ProgramStatus against the spec (revision 0.2): its own
// examples, how a report is worded, and every rule that discards or
// ignores one.
class ProgramStatusTest {
  // As if sent whole: ESC ] 7501; <body> ESC \.
  private fun parse(body: String) = ProgramStatus.parse(body, body.length + 9)

  private fun b64(text: String) = Base64.getEncoder().encodeToString(text.toByteArray(Charsets.UTF_8))

  @Test fun theSpecsExamples() {
    val apply = "QXBwbHkgMyB0byBhZGQsIDEgdG8gY2hhbmdlLCAwIHRvIGRlc3Ryb3k/"
    assertEquals(
      "state=blocked:kind=permission:app=terraform:msg=$apply",
      parse("state=blocked:kind=permission:app=terraform:msg=$apply"),
    )
    assertEquals(
      "state=working:id=us-east:progress=40:title=VVMgRWFzdA==:msg=UHVzaGluZyBpbWFnZQ==",
      parse("state=working:id=us-east:title=VVMgRWFzdA==:progress=40:msg=UHVzaGluZyBpbWFnZQ=="),
    )
    assertEquals("state=done:app=brew:msg=VXBncmFkZWQgMTIgcGFja2FnZXM=", parse("state=done:app=brew:msg=VXBncmFkZWQgMTIgcGFja2FnZXM="))
    assertEquals("state=clear:id=us-east", parse("state=clear:id=us-east"))
    for (state in listOf("idle", "working", "done", "blocked", "error")) assertEquals("state=$state", parse("state=$state"))
  }

  @Test fun theStateComesFirstAndUnknownKeysGo() {
    assertEquals("state=error:app=codex", parse("app=codex:future=1:state=error"))
    assertEquals("state=idle", parse(" state = idle "))
    // The last of a repeated key wins.
    assertEquals("state=working", parse("state=idle:state=working"))
  }

  @Test fun aMalformedPairIsSkippedTheRestCounts() {
    assertEquals("state=done", parse("oops:=x:Big=1:state=done:app=a b"))
    assertEquals("state=done", parse("state=done:app=x;y"))
    // A malformed later pair does not undo an earlier good one.
    assertEquals("state=done", parse("state=done:state=d one"))
  }

  @Test fun aReportWithoutAKnownStateIsIgnored() {
    assertNull(parse(""))
    assertNull(parse("app=x"))
    assertNull(parse("state=paused"))
    assertNull(parse("state=Working"))
  }

  @Test fun keysTheSpecTreatsAsAbsent() {
    assertEquals("state=blocked:kind=auth", parse("state=blocked:kind=auth"))
    assertEquals("state=blocked", parse("state=blocked:kind=coffee"))
    assertEquals("state=working", parse("state=working:kind=auth"))
    assertEquals("state=blocked:progress=0", parse("state=blocked:progress=0"))
    assertEquals("state=working:progress=100", parse("state=working:progress=100"))
    for (p in listOf("101", "-1", "4.5", "", "1000")) assertEquals("state=working", parse("state=working:progress=$p"), p)
    assertEquals("state=done", parse("state=done:progress=50"))
    // An app outside its character set is absent, not a reason to drop the report.
    assertEquals("state=idle", parse("state=idle:app=a,b"))
    assertEquals("state=idle", parse("state=idle:app="))
  }

  @Test fun idsOutsideTheGrammarOrPastTheLimitsDropTheReport() {
    assertEquals("state=done:id=build/test", parse("state=done:id=build/test"))
    assertEquals("state=done:id=${"a".repeat(32)}", parse("state=done:id=${"a".repeat(32)}"))
    assertEquals("state=done:id=${List(8) { "s" }.joinToString("/")}", parse("state=done:id=${List(8) { "s" }.joinToString("/")}"))
    // Grammar breaks, then the limits: 33 per segment, 9 levels, 164 in all.
    for (id in listOf("", "a//b", "/a", "a/", "a,b", "a".repeat(33), List(9) { "s" }.joinToString("/"), List(5) { "x".repeat(32) }.joinToString("/"))) {
      assertNull(parse("state=done:id=$id"), id)
    }
  }

  @Test fun freeTextMustDecodeAndHoldNoControlCharacter() {
    assertEquals("state=done:msg=${b64("ok")}", parse("state=done:msg=${b64("ok")}"))
    // Padding is optional.
    assertEquals("state=done:msg=b2s", parse("state=done:msg=b2s"))
    assertEquals("state=done:title=", parse("state=done:title="))
    assertNull(parse("state=done:msg=b2s.x"))
    assertNull(parse("state=done:msg=A"))
    for (text in listOf("a\nb", "tab\there", "del\u007f", "c1\u0085")) assertNull(parse("state=done:msg=${b64(text)}"), text)
  }

  @Test fun limits() {
    assertEquals("state=done", parse("state=done:${"k".repeat(16)}=v"))
    assertNull(parse("state=done:${"k".repeat(17)}=v"))
    assertEquals("state=done:app=${"a".repeat(32)}", parse("state=done:app=${"a".repeat(32)}"))
    assertNull(parse("state=done:app=${"a".repeat(33)}"))
    assertEquals("state=done:title=${b64("t".repeat(192))}", parse("state=done:title=${b64("t".repeat(192))}"))
    assertNull(parse("state=done:title=${b64("t".repeat(193))}"))
    assertNull(parse("state=done:msg=${b64("m".repeat(2049))}"))
    assertNull(parse("state=done:msg=${"QUFB".repeat(684)}"))
    val body = "state=done:app=x"
    assertEquals("state=done:app=x", ProgramStatus.parse(body, 4096))
    assertNull(ProgramStatus.parse(body, 4097))
  }

  @Test fun theReplyEndsAsTheQueryDid() {
    assertEquals("\u001b]7501;?\u0007", ProgramStatus.reply(bel = true).toString(Charsets.US_ASCII))
    assertEquals("\u001b]7501;?\u001b\\", ProgramStatus.reply(bel = false).toString(Charsets.US_ASCII))
  }
}
