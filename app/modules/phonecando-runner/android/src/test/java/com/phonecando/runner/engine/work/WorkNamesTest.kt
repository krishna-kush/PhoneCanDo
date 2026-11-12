package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.Stdin
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkNamesTest {
  private fun name(vararg argv: String, comm: String? = null) =
    WorkNames.of(ProcDetail(1, 0, 0L, null, 0, comm, argv.toList(), Stdin.NONE, 0L))

  @Test fun theProgramAndUpToTwoWords() {
    assertEquals("npm run dev", name("npm", "run", "dev"))
    assertEquals("python3 -m http.server", name("/usr/bin/python3", "-m", "http.server", "8000"))
    assertEquals("sleep 600", name("sleep", "600"))
    assertEquals("bash", name("-bash"))
  }

  @Test fun aScriptInsteadOfItsInterpreter() {
    assertEquals("vite.js --port 5173", name("node", "/w/node_modules/vite/bin/vite.js", "--port", "5173"))
    assertEquals("manage.py runserver", name("python3.12", "manage.py", "runserver"))
    assertEquals("node -e console.log(1)", name("node", "-e", "console.log(1)"))
  }

  @Test fun stopsBeforeAValueOrALongWord() {
    assertEquals("curl -H", name("curl", "-H", "Authorization: Bearer sk-0123456789abcdef0123456789"))
    assertEquals("deploy", name("deploy", "--token=abc", "x"))
    assertEquals("env", name("env", "API_KEY=secret", "run"))
  }

  @Test fun noCommandLineFallsBackToTheName() {
    assertEquals("gpg-agent", name(comm = "gpg-agent"))
    assertEquals("a process", name())
  }
}
