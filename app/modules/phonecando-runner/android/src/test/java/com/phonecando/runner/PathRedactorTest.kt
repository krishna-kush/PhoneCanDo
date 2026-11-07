package com.phonecando.runner

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.oc.OpencodeKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

// JVM checks for PathRedactor (pure): every path shape, the secrets, and the
// engine stderr tail cut exactly as EngineWatch makes it.
class PathRedactorTest {
  private val pkg = "com.phonecando.app"
  private val app = PathRedactor.forDirs(
    listOf("/data/user/0/$pkg/files", "/data/user/0/$pkg", "/data/data/$pkg"),
  )
  private val base = PathRedactor.BASE

  private fun both(input: String, expected: String) {
    assertEquals(expected, app.redact(input))
    assertEquals(expected, base.redact(input))
  }

  // ---- paths -------------------------------------------------------------

  @Test fun reviewerExample_wholePathNotJustPrefix() {
    both("/data/user/0/$pkg/files/phonecando-home/projects/acme/salaries.csv", "<path>")
    both(
      "open '/data/user/0/$pkg/files/phonecando-home/projects/acme/salaries.csv' failed",
      "open '<path>' failed",
    )
  }

  @Test fun everyLiteralConsumesTheRest() {
    // An app dir no generic pattern knows: only the literal can catch it.
    val custom = PathRedactor.forDirs(listOf("/custom/appdata/$pkg/"))
    val path = "/custom/appdata/$pkg/files/phonecando-home/projects/acme/salaries.csv"
    assertEquals("x <path> y", custom.redact("x $path y"))
    assertEquals("x $path y", base.redact("x $path y"))
    // A bare "/" or a short prefix is never a literal.
    assertEquals("/usr/bin/env", PathRedactor.forDirs(listOf("/", "/data", "/usr")).redact("/usr/bin/env"))
  }

  @Test fun dataShapes() {
    both("/data/data/$pkg/files/x.json", "<path>")
    both("/data/user_de/0/$pkg/shared_prefs/a.xml", "<path>")
    both("/data/user/10/com.other.app/files/notes.txt", "<path>")
    both("/data/media/0/DCIM/Camera/IMG_1.jpg", "<path>")
    both("/data/app/~~Zx3==/$pkg-Q1==/lib/arm64/liboc-engine.so", "<path>")
    both("/data/user/0", "<path>")
  }

  @Test fun storageShapes() {
    both("/storage/emulated/0/Download/salaries.csv", "<path>")
    both("/storage/self/primary/Documents/a.txt", "<path>")
    both("/storage/1A2B-3C4D/DCIM/x.jpg", "<path>")
    both("/sdcard/Download/a.pdf", "<path>")
    both("ls /sdcard", "ls <path>")
    both("/mnt/media_rw/1A2B-3C4D/x.bin", "<path>")
    both("/mnt/expand/0c1d-uuid/user/0/$pkg/files/a", "<path>")
  }

  @Test fun homeAndUris() {
    both("cd ~/projects/acme && ls", "cd <path> && ls")
    both("HOME=~/x", "HOME=<path>")
    both("dir: ~/a/b", "dir: <path>")
    both("a~/b", "a~/b")
    both("file:///data/user/0/$pkg/files/a.html#top", "<path>")
    both("FILE:///android_asset/index.html", "<path>")
    both(
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fsalaries.csv",
      "<path>",
    )
  }

  @Test fun urlEncoded() {
    both(
      "GET /api/file?path=%2Fdata%2Fuser%2F0%2F$pkg%2Ffiles%2Fa.csv HTTP/1.1",
      "GET /api/file?path=<path> HTTP/1.1",
    )
    both("q=%2fstorage%2femulated%2F0%2Fx.txt", "q=<path>")
    both("q=%252Fdata%252Fdata%252F$pkg", "q=<path>")
    both("q=%2Fsdcard%2Fa", "q=<path>")
    both("q=%2Fmnt%2Fmedia_rw", "q=<path>")
    both("q=%2Fdatabase", "q=%2Fdatabase")
  }

  @Test fun pathEndsAtEveryStop() {
    for (stop in listOf(' ', '\t', '\n', '\r', '\'', '"', '`', '(', ')', '<', '>', '[', ']', '{', '}', ',', ';')) {
      both("/sdcard/a b$stop" + "rest", "<path> b${stop}rest")
      both("/storage/emulated/0/x.txt${stop}rest", "<path>${stop}rest")
    }
    // ':' and '=' are path characters.
    both("/sdcard/a:b=c/d e", "<path> e")
  }

  @Test fun frameLineSuffixStays() {
    both(
      "    at load (/data/user/0/$pkg/files/phonecando-home/.config/opencode/plugins/mobile/index.ts:42:7)",
      "    at load (<path>:42:7)",
    )
    both("com.x.Gen.run(/data/data/$pkg/files/Gen.kt:12)", "com.x.Gen.run(<path>:12)")
    both("/storage/emulated/0/a.js:3", "<path>:3")
    both("com.phonecando.runner.Foo.bar(Foo.kt:12)", "com.phonecando.runner.Foo.bar(Foo.kt:12)")
    // A colon not followed by a line number belongs to the path.
    both("/sdcard/x:y/z.txt:9 end", "<path>:9 end")
  }

  // ---- quoted paths and file-error suffixes ------------------------------

  @Test fun quotedPathWithSpacesIsConsumedWhole() {
    both("\"/storage/emulated/0/Download/Tax Return 2025.pdf\"", "\"<path>\"")
    both("open '/data/user/0/$pkg/files/My File.txt' failed", "open '<path>' failed")
    both("see `~/My Docs/a b.md` here", "see `<path>` here")
    both("{\"file\":\"/sdcard/Download/Tax Return 2025.pdf\",\"n\":1}", "{\"file\":\"<path>\",\"n\":1}")
    // Only the quote that opened it closes it.
    both("'/sdcard/Bob \"x\" y.txt' end", "'<path>' end")
    both("\"/sdcard/it's here.txt\" end", "\"<path>\" end")
    // A backslash escapes the next character, as in a JSON string.
    both("{\"f\":\"/sdcard/a\\\"b c.txt\"}", "{\"f\":\"<path>\"}")
    // A frame position stays.
    both("at f (\"/sdcard/My App/index.js:12:3\")", "at f (\"<path>:12:3\")")
    both("cp '/sdcard/a b.txt' '/storage/emulated/0/c d.txt'", "cp '<path>' '<path>'")
    // Literal app dirs too.
    assertEquals("'<path>'", PathRedactor.forDirs(listOf("/custom/appdata/$pkg")).redact("'/custom/appdata/$pkg/a b/c d'"))
  }

  @Test fun enoentOpenShape() {
    both(
      "Error: ENOENT: no such file or directory, open '/storage/emulated/0/Download/My File.txt'",
      "Error: ENOENT: no such file or directory, open '<path>'",
    )
    both(
      "ENOENT: no such file or directory, open '/data/user/0/$pkg/files/phonecando-home/My Notes/todo list.md'\n" +
        "    at open (node:fs:1:2)",
      "ENOENT: no such file or directory, open '<path>'\n    at open (node:fs:1:2)",
    )
  }

  @Test fun quotedStartWithoutAClosingQuoteOnItsLineIsUnquoted() {
    both("open '/sdcard/a b", "open '<path> b")
    // A closing quote on the next line does not count.
    both("open '/sdcard/a b\nc' d", "open '<path> b\nc' d")
    both("open \"/sdcard/a b \\\" c", "open \"<path> b \\\" c")
  }

  @Test fun javaFileErrorSuffixEndsAnUnquotedPathWithSpaces() {
    both(
      "java.io.FileNotFoundException: /storage/emulated/0/Download/Tax Return 2025.pdf: open failed: ENOENT " +
        "(No such file or directory)",
      "java.io.FileNotFoundException: <path>: open failed: ENOENT (No such file or directory)",
    )
    both("/sdcard/My Docs/plan v2.txt (No such file or directory)", "<path> (No such file or directory)")
    both("x /data/user/0/$pkg/files/a b/c (Permission denied)", "x <path> (Permission denied)")
    both("/mnt/media_rw/X Y/z (Is a directory)", "<path> (Is a directory)")
    both("/storage/1A2B-3C4D/My Music (Read-only file system)", "<path> (Read-only file system)")
    both("/sdcard/a b: OPEN FAILED: EACCES (Permission denied)", "<path>: OPEN FAILED: EACCES (Permission denied)")
    // A frame position before the suffix stays.
    both("/sdcard/a b.js:3:4 (No such file or directory)", "<path>:3:4 (No such file or directory)")
    // Only a suffix on the same line counts.
    both("/sdcard/a b\nx (No such file or directory)", "<path> b\nx (No such file or directory)")
    both(
      "/sdcard/a b (Is a directory)\n/sdcard/c d: open failed: EISDIR (Is a directory)",
      "<path> (Is a directory)\n<path>: open failed: EISDIR (Is a directory)",
    )
    // A quoted path keeps its own end; a quoted start without one takes the suffix.
    both("open '/sdcard/a b' x: open failed: y", "open '<path>' x: open failed: y")
    both("open '/sdcard/a b (No such file or directory)", "open '<path> (No such file or directory)")
    // Not a device path: nothing to end.
    both("/usr/lib/a b (No such file or directory)", "/usr/lib/a b (No such file or directory)")
  }

  @Test fun quotedAndSuffixRulesAreIdempotent() {
    for (text in listOf(
      "open '/storage/emulated/0/Download/My File.txt' and \"/sdcard/x y\"",
      "java.io.FileNotFoundException: /sdcard/Tax Return 2025.pdf: open failed: ENOENT (No such file or directory)",
      "open '/sdcard/a b\nc' d /sdcard/e f (Permission denied)",
    )) {
      val once = app.redact(text)
      assertEquals(once, app.redact(once))
      assertFalse(once, once.contains("Return") || once.contains("File.txt") || once.contains(" y") || once.contains("e f"))
    }
  }

  @Test(timeout = 10_000) fun longLinesStayLinearAndNeverOverflowTheStack() {
    // One quoted path of 200k characters full of escapes: a regex group
    // repetition would recurse once per character.
    val body = "/sdcard/" + "x\\\"y ".repeat(40_000)
    assertEquals("\"<path>\" end", app.redact("\"$body\" end"))
    // Thousands of paths on one line and no suffix; same-type quotes pair up.
    assertEquals("<path> b ".repeat(5_000), app.redact("/sdcard/a b ".repeat(5_000)))
    assertEquals("'<path>".repeat(4_999) + "'<path> b ", app.redact("'/sdcard/a b ".repeat(5_000)))
    // Thousands of quoted starts whose line holds no closing quote (each
    // opener is escaped): the line is scanned once, not once per start.
    assertEquals("x\\'<path> b ".repeat(5_000), app.redact("x\\'/sdcard/a b ".repeat(5_000)))
    // Thousands of starts before one suffix: the first runs to it.
    assertEquals("<path> (No such file or directory)", app.redact("/sdcard/a ".repeat(5_000) + "(No such file or directory)"))
  }

  @Test fun unrelatedTextStays() {
    for (text in listOf(
      "/data/database/x", "/data/local/tmp/x", "/usr/lib/libc.so", "/storage", "/api/session",
      "http://127.0.0.1:4097/api/event", "serve exited (code 1)",
    )) {
      both(text, text)
    }
  }

  // ---- secrets -----------------------------------------------------------

  private val pw = "0123456789abcdef0123456789abcdef"
  private val token = "fedcba9876543210fedcba9876543210"

  @Test fun engineSecrets() {
    val basic = Base64.getEncoder().encodeToString("opencode:$pw".toByteArray())
    assertEquals(listOf(pw, basic, token), PathRedactor.engineSecrets(OpencodeKind, pw, token))
    assertEquals(listOf(token), PathRedactor.engineSecrets(OpencodeKind, null, token))
    assertEquals(emptyList<String>(), PathRedactor.engineSecrets(OpencodeKind, "", null))
    val secrets = PathRedactor.engineSecrets(OpencodeKind, pw, token)
    assertEquals("pw=<secret> token=<secret>", app.redact("pw=$pw token=$token", secrets))
    assertEquals("cred <secret> ok", app.redact("cred $basic ok", secrets))
    // Too short to be one of ours: left alone.
    assertEquals("abc", app.redact("abc", listOf("abc")))
  }

  @Test fun everyAgentsSecrets() {
    val pw2 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    val token2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    val pw3 = "cccccccccccccccccccccccccccccccc"
    val token3 = "dddddddddddddddddddddddddddddddd"
    val agents = listOf(
      AgentRecord("a1", "opencode", "One", "i1", "4097", pw, token, 1L),
      AgentRecord("a2", "opencode", "Two", "i2", null, pw2, token2, 2L),
      // A kind this build lacks: its raw values still go.
      AgentRecord("a3", "future-kind", "Three", "i3", null, pw3, token3, 3L),
    )
    val basic2 = Base64.getEncoder().encodeToString("opencode:$pw2".toByteArray())
    val secrets = PathRedactor.agentSecrets(agents)
    assertEquals(PathRedactor.engineSecrets(OpencodeKind, pw, token) + listOf(pw2, basic2, token2, pw3, token3), secrets)
    assertEquals(
      "one <secret> <secret> two <secret> <secret> three <secret> <secret>",
      app.redact("one $pw $token two $basic2 $token2 three $pw3 $token3", secrets),
    )
    assertEquals(emptyList<String>(), PathRedactor.agentSecrets(emptyList()))
  }

  @Test fun authorizationValues() {
    both("Authorization: Basic b3BlbmNvZGU6c2VjcmV0", "Authorization: Basic <secret>")
    both("authorization: Bearer abc.def-ghi", "authorization: Bearer <secret>")
    both("{\"Authorization\":\"Bearer sometoken123\"}", "{\"Authorization\":\"Bearer <secret>\"}")
    both("Proxy-Authorization: Digest abcdef", "Proxy-Authorization: Digest <secret>")
    both("x-api-key: abc123", "x-api-key: <secret>")
    both("Authorization=rawtoken", "Authorization=<secret>")
    both("curl -H 'Authorization: Bearer xyz12345678' http://x", "curl -H 'Authorization: Bearer <secret>' http://x")
    both("using Bearer abcdefghijkl now", "using Bearer <secret> now")
    both("basic auth=ok, a basic idea", "basic auth=ok, a basic idea")
  }

  @Test fun providerKeys() {
    both("Incorrect API key provided: sk-proj-abcdefghijklmnop1234.", "Incorrect API key provided: <secret>.")
    both("key sk-ant-api03-AAAAAAAAAAAAAAAAAAAA end", "key <secret> end")
    both("AIzaSyA1234567890abcdefghijklmnopqrstu", "<secret>")
    both("ghp_0123456789abcdefABCDEF", "<secret>")
    both("task-runner-for-everything", "task-runner-for-everything")
  }

  @Test fun secretInsideAPathKeepsThePathWhole() {
    val secrets = PathRedactor.engineSecrets(OpencodeKind, pw, token)
    both("/data/user/0/$pkg/files/sk-learn-experiments-2024/salaries.csv x", "<path> x")
    assertEquals("<path> x", app.redact("/sdcard/$token/salaries.csv x", secrets))
  }

  @Test fun redactingTwiceChangesNothing() {
    val secrets = PathRedactor.engineSecrets(OpencodeKind, pw, token)
    val sample = "Authorization: Bearer $token\nat f (/data/user/0/$pkg/files/a.ts:1:2) ~/x " +
      "sk-abcdefghijklmnopqrst file:///sdcard/y %2Fdata%2Fdata%2Fz Basic abcdefghijk"
    val once = app.redact(sample, secrets)
    assertEquals(once, app.redact(once, secrets))
    assertFalse(once.contains(token))
    assertFalse(once.contains("files/a.ts"))
  }

  // ---- stderr tail (EngineWatch) ----------------------------------------

  private val window = 16 * 1024
  private val cap = 2048

  // What EngineWatch.stderrTail does with engine.log, minus the file.
  private fun tailOf(log: String, windowBytes: Int = window): String? {
    val bytes = log.toByteArray(Charsets.UTF_8)
    val start = maxOf(0, bytes.size - windowBytes)
    return app.tail(bytes.copyOfRange(start, bytes.size), start > 0, cap, PathRedactor.engineSecrets(OpencodeKind, pw, token))
  }

  private fun assertCapped(tail: String?) {
    if (tail == null) return
    assertTrue(tail.toByteArray(Charsets.UTF_8).size <= cap)
    assertFalse("no broken character", tail.contains('\uFFFD'))
  }

  @Test fun reviewerExample_lineLongerThanTheWindow() {
    // One line far longer than the window: the window starts inside the path,
    // after its /data/user/0 start.
    val log = "error reading /data/user/0/$pkg/files/phonecando-home/projects/acme/" +
      "d".repeat(20_000) + "/salaries.csv: EACCES\n"
    val tail = tailOf(log)
    assertEquals(" EACCES", tail)
    // Same without the final line break.
    assertEquals(" EACCES", tailOf(log.trimEnd()))
  }

  @Test fun cutFirstLineDropped() {
    val log = "x /data/user/0/$pkg/files/" + "p".repeat(16_400) + "/salaries.csv\n" +
      "next line /sdcard/a.txt\nlast\n"
    assertEquals("next line <path>\nlast", tailOf(log))
  }

  @Test fun windowNeverCutsALabelFromItsSecret() {
    val head = "q".repeat(20_000) + " Bearer"
    val log = "$head SECRETVALUE123456789 tail words"
    // Cut on the space before the value, inside "Bearer", inside the value.
    for (cutAt in listOf(head.length, head.length - 4, head.length + 4)) {
      val tail = tailOf(log, log.length - cutAt)
      assertEquals(" tail words", tail)
    }
    // Label inside the window, after the cut-off token: redacted, kept.
    assertEquals(" Bearer <secret> tail words", tailOf(log, log.length - (head.length - 8)))
    // A window that starts with the label drops it (it may be cut off) but
    // its value is already redacted.
    assertEquals("<secret> tail words", tailOf(log, log.length - (head.length - 6)))
  }

  @Test fun windowStartingAtAPathKeepsItsPlaceholder() {
    val head = "w".repeat(20_000) + " "
    val log = "$head/data/user/0/$pkg/files/y.csv tail"
    assertEquals("<path> tail", tailOf(log, log.length - head.length))
  }

  @Test fun fragmentOnlyWindowIsNull() {
    assertNull(tailOf("d".repeat(40_000)))
  }

  @Test fun shortLogKeptWhole() {
    assertEquals("first line\nsecond <path>", tailOf("first line\nsecond /sdcard/x\n"))
  }

  @Test fun pathAcrossTheFinalCutIsAlreadyRedacted() {
    // Raw, the path would straddle the 2 KB cut; redacted first, it cannot.
    val log = "a".repeat(3000) + "\n/data/user/0/$pkg/files/" + "p".repeat(3000) + "/salaries.csv end\n"
    assertEquals("<path> end", tailOf(log))
  }

  @Test fun multibyteCutsLandOnCharacterBoundaries() {
    val lines = (1..400).joinToString("\n") { "é line $it 🙂 /storage/emulated/0/f$it.txt" }
    val tail = tailOf(lines + "\nend")
    assertCapped(tail)
    assertTrue(tail!!.endsWith("\nend"))
    assertFalse(tail.contains("f400.txt"))
    // A window that starts inside a multi-byte character.
    val wide = "é".repeat(10_000) + "\nend"
    assertEquals("end", tailOf(wide, 16_385))
  }

  @Test fun everyTailIsCapped() {
    val log = (1..2000).joinToString("\n") { "line $it Authorization: Bearer tok$it-abcdef" }
    val tail = tailOf(log)
    assertCapped(tail)
    assertFalse(tail!!.contains("tok2000"))
    assertTrue(tail.endsWith("line 2000 Authorization: Bearer <secret>"))
  }
}
