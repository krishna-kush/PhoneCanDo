package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail
import com.phonecando.runner.engine.proc.Stdin
import com.phonecando.runner.engine.work.AgentWork.Verdict
import org.junit.Assert.assertEquals
import org.junit.Test

// Vectors for telling an agent's jobs from the agent itself, one shape per
// test, with the shapes the agent kinds really spawn (a fresh shell per
// command, `bash -c` that execs away, stdio MCP servers, language servers,
// a persistent shell, orphans).
class AgentWorkTest {
  private val input = 100_000L
  private val now = 200_000L

  private val nul = Stdin(Stdin.Kind.NULL)
  private val tty = Stdin(Stdin.Kind.TTY)

  private fun pipe(inode: Long) = Stdin(Stdin.Kind.PIPE, inode)

  private fun socket(inode: Long) = Stdin(Stdin.Kind.SOCKET, inode)

  private fun p(
    pid: Int,
    ppid: Int,
    startedAt: Long,
    vararg argv: String,
    stdin: Stdin = nul,
    tag: String? = "a1",
    tracer: Int = 0,
    exe: String? = null,
  ) = ProcDetail(pid, ppid, startedAt, tag, tracer, argv.firstOrNull(), argv.toList(), stdin, 0L, exe = exe)

  private val launcher = "libphonecando_launch.so"
  private val proot = "libproot.so"
  private val loader = "libproot-loader.so"

  // The agent as it was at the first input: the launcher, proot, claude.
  private val agent = listOf(
    p(10, 1, 1_000, "launcher"),
    p(11, 10, 2_000, "proot"),
    p(12, 11, 3_000, "node", "/usr/bin/claude", stdin = tty, tracer = 11),
  )

  private fun verdicts(members: List<ProcDetail>, writers: Map<Long, Set<Int>>? = emptyMap(), firstInput: Long? = input) =
    AgentWork.judge(members, firstInput, now, writers).associate { it.proc.pid to it.verdict }

  @Test fun beforeAnyInputAllIsTheAgent() {
    val all = agent + p(20, 12, 150_000, "sleep", "600")
    assertEquals(setOf(Verdict.OWN), verdicts(all, firstInput = null).values.toSet())
  }

  @Test fun aHookWaitingInOurKitScriptIsTheAgentsNotAJob() {
    // Claude Code's Stop hook after a turn: sh -c runs phonecando-inbox --wait, which sleeps in a loop.
    val hook = "sh /root/.phonecando/bin/phonecando-inbox --wait Stop 3600 || { r=${'$'}?; exit ${'$'}r; }"
    val all = agent +
      p(20, 12, 150_000, "sh", "-c", hook) +
      p(21, 20, 150_100, "sh", "/root/.phonecando/bin/phonecando-inbox", "--wait", "Stop", "3600") +
      p(22, 21, 170_000, "sleep", "1")
    val v = verdicts(all)
    assertEquals(Verdict.HELPER, v[20])
    assertEquals(Verdict.HELPER, v[21])
    assertEquals(Verdict.HELPER, v[22])
    assertEquals(emptyList<ProcDetail>(), AgentWork.jobs(AgentWork.judge(all, input, now, emptyMap())))
  }

  @Test fun theAgentAloneHasNoWork() {
    assertEquals(mapOf(10 to Verdict.OWN, 11 to Verdict.OWN, 12 to Verdict.OWN), verdicts(agent))
  }

  @Test fun aBackgroundShellAndWhatItRunsAreWork() {
    // Claude Code's run_in_background: a fresh shell, stdin /dev/null, npm under it.
    val all = agent + p(20, 12, 150_000, "bash", "-c", "-l", "eval 'npm run dev'") +
      p(21, 20, 151_000, "npm", "run", "dev") + p(22, 21, 152_000, "sh", "-c", "vite") + p(23, 22, 153_000, "node", "/w/node_modules/.bin/vite")
    val v = verdicts(all)
    assertEquals(listOf(Verdict.WORK, Verdict.WORK, Verdict.WORK, Verdict.WORK), listOf(20, 21, 22, 23).map { v[it] })
    val jobs = AgentWork.jobs(AgentWork.judge(all, input, now, emptyMap()))
    assertEquals(listOf(21), jobs.map { it.pid })
  }

  @Test fun aCommandThatExecedAwayItsShellIsWork() {
    // `bash -c 'sleep 600'` is `sleep` alone, its stdin /dev/null.
    val all = agent + p(20, 12, 150_000, "sleep", "600")
    assertEquals(Verdict.WORK, verdicts(all)[20])
  }

  @Test fun anOrphanIsWork() {
    val all = agent + p(20, 1, 150_000, "sleep", "600", stdin = pipe(5))
    assertEquals(Verdict.WORK, verdicts(all, mapOf(5L to setOf(12)))[20])
  }

  @Test fun aStdioServerTheAgentWritesIsAHelperAndSoAreItsChildren() {
    // An MCP server started after the first input: npx, then node, both on
    // the pipe the agent writes.
    val all = agent + p(20, 12, 150_000, "npx", "-y", "some-mcp", stdin = pipe(5)) +
      p(21, 20, 151_000, "node", "/x/some-mcp/index.js", stdin = pipe(5))
    assertEquals(mapOf(20 to Verdict.HELPER, 21 to Verdict.HELPER), verdicts(all, mapOf(5L to setOf(12))).filterKeys { it >= 20 })
  }

  @Test fun aLanguageServersOwnChildIsAHelper() {
    val all = agent + p(20, 12, 150_000, "typescript-language-server", "--stdio", stdin = pipe(5)) +
      p(21, 20, 151_000, "node", "/x/tsserver.js", stdin = pipe(6))
    val v = verdicts(all, mapOf(5L to setOf(12), 6L to setOf(20)))
    assertEquals(Verdict.HELPER, v[21])
  }

  @Test fun aPipeNobodyOfTheAgentWritesIsWork() {
    // The agent closed the write end (or a job holds it): a command.
    val all = agent + p(20, 12, 150_000, "python3", "-m", "http.server", stdin = pipe(5)) + p(21, 1, 140_000, "tee", stdin = nul)
    assertEquals(Verdict.WORK, verdicts(all, mapOf(5L to emptySet()))[20])
    assertEquals(Verdict.WORK, verdicts(all, mapOf(5L to setOf(21)))[20])
  }

  @Test fun unreadableWritersFallBackToTheParent() {
    val all = agent + p(20, 12, 150_000, "mcp-server", stdin = pipe(5)) + p(21, 1, 150_000, "worker", stdin = pipe(6))
    val v = verdicts(all, writers = null)
    assertEquals(Verdict.HELPER, v[20])
    assertEquals(Verdict.WORK, v[21])
  }

  @Test fun aSocketFromTheAgentIsAHelperAndFromAJobIsWork() {
    val all = agent + p(20, 12, 150_000, "npx", "mcp", stdin = socket(9)) +
      p(30, 12, 150_000, "bash", "-c", "x") + p(31, 30, 151_000, "worker", stdin = socket(10))
    val v = verdicts(all)
    assertEquals(Verdict.HELPER, v[20])
    assertEquals(Verdict.WORK, v[31])
  }

  @Test fun aShellIsWorkWhateverItsStdin() {
    val all = agent + p(20, 12, 150_000, "sh", "-c", "an mcp server", stdin = pipe(5)) + p(21, 20, 151_000, "server", stdin = pipe(5))
    val v = verdicts(all, mapOf(5L to setOf(12)))
    assertEquals(Verdict.WORK, v[20])
    assertEquals(Verdict.WORK, v[21])
  }

  @Test fun aCommandOfTheAgentsOwnShellIsWork() {
    // A kind that keeps one shell open: its commands share the shell's pipe.
    val all = agent + p(13, 12, 4_000, "-bash", stdin = pipe(5)) + p(20, 13, 150_000, "make", "build", stdin = pipe(5))
    val v = verdicts(all, mapOf(5L to setOf(12)))
    assertEquals(Verdict.OWN, v[13])
    assertEquals(Verdict.WORK, v[20])
  }

  @Test fun aWrapperShellAboveTheAgentDoesNotMakeItsHelpersWork() {
    val wrapped = listOf(p(10, 1, 1_000, "sh", "-c", "claude"), p(12, 10, 2_000, "claude", stdin = tty))
    val all = wrapped + p(20, 12, 150_000, "mcp-server", stdin = pipe(5))
    assertEquals(Verdict.HELPER, verdicts(all, mapOf(5L to setOf(12)))[20])
  }

  @Test fun aHookYoungerThanTenSecondsIsNotWorkYet() {
    val all = agent + p(20, 12, now - 3_000, "phonecando-event", "stop")
    assertEquals(Verdict.YOUNG, verdicts(all)[20])
    assertEquals(emptyList<ProcDetail>(), AgentWork.jobs(AgentWork.judge(all, input, now, emptyMap())))
  }

  // A native agent (opencode) outside proot, as on the phone.
  private val native = listOf(p(10, 1, 1_000, "liboc-engine.so", "serve", stdin = pipe(3), exe = "liboc-engine.so"))

  @Test fun anMcpServerStartedLaterThroughOurRuntimeIsAHelper() {
    // As on the phone: opencode asks the machine's shim for
    // `bash -c 'exec python3 probe.py'`; the shim (our launcher, named bash)
    // starts proot, which drops its stdin; the server inside has opencode's
    // socket as stdin.
    val all = native +
      p(20, 10, 150_000, "bash", "-c", "exec python3 -u probe.py", stdin = socket(9), exe = launcher) +
      p(21, 20, 150_100, "libproot.so", "-L", "--link2symlink", stdin = nul, exe = proot) +
      p(22, 21, 150_300, "python3", "-u", "probe.py", stdin = socket(9), tracer = 21, exe = loader)
    val judged = AgentWork.judge(all, input, now, emptyMap())
    assertEquals(mapOf(20 to Verdict.HELPER, 21 to Verdict.HELPER, 22 to Verdict.HELPER), judged.associate { it.proc.pid to it.verdict }.filterKeys { it >= 20 })
    assertEquals(emptyList<ProcDetail>(), AgentWork.jobs(judged))
  }

  @Test fun aPipeServerThroughOurRuntimeIsAHelperWhenTheAgentWritesIt() {
    val all = native +
      p(20, 10, 150_000, "bash", "-c", "exec mcp-server", stdin = pipe(5), exe = launcher) +
      p(21, 20, 150_100, "libproot.so", stdin = nul, exe = proot) +
      p(22, 21, 150_300, "mcp-server", stdin = pipe(5), tracer = 21, exe = loader)
    assertEquals(Verdict.HELPER, verdicts(all, mapOf(5L to setOf(10)))[22])
    assertEquals(Verdict.WORK, verdicts(all, mapOf(5L to emptySet()))[22])
  }

  @Test fun aCommandThroughOurRuntimeIsWorkAndSoIsItsCarrier() {
    // opencode's bash tool: stdin ignored, a real shell inside.
    val all = native +
      p(20, 10, 150_000, "bash", "-c", "npm test", stdin = nul, exe = launcher) +
      p(21, 20, 150_100, "libproot.so", stdin = nul, exe = proot) +
      p(22, 21, 150_300, "bash", "-c", "npm test", stdin = nul, tracer = 21, exe = loader) +
      p(23, 22, 150_500, "npm", "test", stdin = nul, tracer = 21, exe = loader)
    val judged = AgentWork.judge(all, input, now, emptyMap())
    assertEquals(setOf(Verdict.WORK), judged.filter { it.proc.pid >= 20 }.map { it.verdict }.toSet())
    assertEquals(listOf(23), AgentWork.jobs(judged).map { it.pid })
  }

  @Test fun ourRuntimeWithNothingUnderItIsNotWork() {
    val all = native + p(21, 1, 150_000, "libproot.so", stdin = nul, exe = proot)
    assertEquals(Verdict.HELPER, verdicts(all)[21])
  }

  @Test fun theLoaderIsNeverSeenThrough() {
    // Every guest runs proot's loader: a guest shell stays a shell.
    val all = agent + p(20, 12, 150_000, "bash", stdin = pipe(5), tracer = 11, exe = loader)
    assertEquals(Verdict.WORK, verdicts(all, mapOf(5L to setOf(12)))[20])
  }

  @Test fun aProotLeftTracingAJobIsWorkButNamedByItsTracee() {
    // As on the phone: opencode's command ended, its proot stays tracing
    // the nohup'd server, both orphans.
    val all = agent + p(20, 1, 150_000, "libproot.so", "-L", "--link2symlink", exe = proot) +
      p(21, 1, 151_000, "python3", "-m", "http.server", tracer = 20, exe = loader)
    val judged = AgentWork.judge(all, input, now, emptyMap())
    assertEquals(mapOf(20 to Verdict.WORK, 21 to Verdict.WORK), judged.associate { it.proc.pid to it.verdict }.filterKeys { it >= 20 })
    assertEquals(listOf(21), AgentWork.jobs(judged).map { it.pid })
  }

  @Test fun jobsNameTheShellWhenNothingElseRuns() {
    val all = agent + p(20, 12, 150_000, "bash")
    assertEquals(listOf(20), AgentWork.jobs(AgentWork.judge(all, input, now, emptyMap())).map { it.pid })
  }

  @Test fun membersAreTaggedOrTracedByATaggedProot() {
    val all = agent + p(20, 12, 150_000, "env-cleared", tag = null, tracer = 11) +
      p(30, 1, 1_000, "other-agent", tag = "a2") + p(31, 30, 150_000, "its-child", tag = null, tracer = 30) +
      p(40, 1, 1_000, "terminal-shell", tag = null)
    assertEquals(listOf(10, 11, 12, 20), AgentWork.members(all, "a1").map { it.pid })
  }

  @Test fun pipesToCheckAreOnlyThoseOfLaterProcesses() {
    val all = agent + p(13, 12, 4_000, "x", stdin = pipe(4)) + p(20, 12, 150_000, "y", stdin = pipe(5)) + p(21, 12, 150_000, "z", stdin = nul)
    assertEquals(setOf(5L), AgentWork.pipesToCheck(all, input))
    assertEquals(emptySet<Long>(), AgentWork.pipesToCheck(all, null))
  }
}
