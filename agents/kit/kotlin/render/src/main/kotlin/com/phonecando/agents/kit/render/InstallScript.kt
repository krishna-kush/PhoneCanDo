package com.phonecando.agents.kit.render

// The guest script of an InstallPlan, built phase by phase. Everything runs
// inside one function, called with stdin from /dev/null: the script itself
// reaches the guest's `sh -s` on stdin, so the shell parses the whole body
// before it runs a line, and no command can read the rest of it as input.
// The runner runs it with HOME the image home, and {{home}} is ${HOME}
// throughout; every runtime's paths go first on PATH. A runtime is checked
// first and installed only when the check fails: its script (inlined, since
// the plugin folder is not in the guest) runs in its own `sh -c` process,
// from a variable a quoted heredoc fills, so it too is parsed whole, reads
// nothing and may `exit`; then the check must pass. Words from manifests go
// in quoted; install steps go in as written.
//
// A unit that may reach the network (a runtime's script, the packages, each
// step; a mobile network drops DNS and connections now and then) runs
// through `phonecando_retry`, up to [attempts] times in all: each attempt in
// a subshell with `set -e` (a step's `cd`, variables and `exit` end with
// it), and after a failed one with attempts left the script prints
// `@retry <phase> <n>/<attempts>` on its own line (n the attempt about to
// start, 2 for the first retry), sleeps 5 s times the attempt that failed
// (n - 1) and runs the unit again.
// After the last failure the script exits with the unit's status. So every
// unit must be safe to run again. A step's lines go into a function of
// their own, which the shell parses with the rest of the body (no eval).
internal class InstallScript(private val kind: String, paths: List<String>, private val attempts: Int) {
  // The function's body, each line as it goes into the script.
  private val body = mutableListOf<String>()
  private val phases = mutableListOf<String>()

  init {
    require(attempts >= 1) { "attempts must be at least 1, not $attempts" }
    if (paths.isNotEmpty()) {
      line("PATH=${word(paths.joinToString(":"))}:\"\$PATH\"")
      line("export PATH")
    }
  }

  fun phase(name: String) {
    phases += name
    line("echo ${ShellQuote.word("@phase $name")}")
  }

  /** Shell lines (templates, {{home}} as ${HOME}) run as one unit of the current phase, retried. */
  fun retried(lines: List<String>) {
    line("$STEP() {")
    lines.forEach { line("  " + Templates.render(it, mapOf(HOME to HOME_VAR))) }
    line("}")
    line(retry(STEP))
  }

  /** A command from argv templates, each a quoted word, run once. */
  fun command(argv: List<String>) {
    line(words(argv))
  }

  fun runtime(runtime: BoundRuntime, script: String) {
    val id = runtime.plugin.id
    val check = runtime.plugin.manifest.check
    val ere = ShellRegex.ere(check.pattern)
    require(script.lines().none { it == EOF }) { "runtime $id's install script holds the line $EOF" }
    val atLeast = runtime.atLeast?.let { " && [ \"\$v\" -ge $it ]" }.orEmpty()
    val needs = id + (runtime.atLeast?.let { ">=$it" } ?: "")
    phase("runtime:$id")
    line("phonecando_runtime_ok() {")
    line(
      "  v=\$(${words(check.argv)} 2>/dev/null | grep -oE ${ShellQuote.word(ere)} | head -n 1 |" +
        " sed -nE ${ShellQuote.word(ShellRegex.groupOne(ere))})",
    )
    line("  [ -n \"\$v\" ]$atLeast")
    line("}")
    line("if ! phonecando_runtime_ok; then")
    line("  phonecando_script=\$(cat <<'$EOF'")
    // A heredoc's body and delimiter go in unindented.
    body += script.trimEnd('\n')
    body += EOF
    line("  )")
    line("  " + retry("sh -c \"\$phonecando_script\" ${ShellQuote.word("runtime-$id")}"))
    line("  phonecando_runtime_ok || { echo ${ShellQuote.word("$id: its install did not give $needs")} >&2; exit 1; }")
    line("fi")
  }

  fun finish(timeoutSec: Int): InstallPlan {
    val text = buildString {
      append("# ").append(kind).append(": rendered by the kit's InstallRenderer, for sh -s with HOME the image home\n")
      append("set -eu\n")
      RETRY.forEach { append(it).append('\n') }
      append("phonecando_install() {\n")
      body.forEach { append(it).append('\n') }
      append("}\n")
      append("phonecando_install </dev/null\n")
    }
    return InstallPlan(text, timeoutSec, phases.toList())
  }

  private fun retry(command: String): String {
    val phase = checkNotNull(phases.lastOrNull()) { "a retried unit comes after a phase" }
    return "phonecando_retry ${ShellQuote.word(phase)} $attempts $command"
  }

  private fun line(text: String) {
    body += "  $text"
  }

  private fun words(argv: List<String>) = argv.joinToString(" ", transform = ::word)

  // One shell word from a template: its text single-quoted, each {{home}}
  // a double-quoted ${HOME} between, so the shell expands only that.
  private fun word(template: String): String {
    Templates.render(template, mapOf(HOME to "")) // refuses any other placeholder
    return template.split("{{$HOME}}")
      .mapIndexed { i, part -> (if (i > 0) "\"$HOME_VAR\"" else "") + (if (part.isEmpty()) "" else ShellQuote.word(part)) }
      .joinToString("")
      .ifEmpty { "''" }
  }

  private companion object {
    const val EOF = "PHONECANDO_RUNTIME_SCRIPT"
    const val HOME = "home"
    const val HOME_VAR = "\${HOME}"
    const val STEP = "phonecando_step"

    // phonecando_retry <phase> <attempts> <command> [args...]. `set +e`
    // around the subshell, so a failed attempt is a status we read and not
    // the script's end; inside it `set -e` holds again, since a subshell
    // run as a plain command (not an `if` or `||` operand) keeps it.
    val RETRY = listOf(
      "phonecando_retry() {",
      "  phonecando_phase=\$1",
      "  phonecando_max=\$2",
      "  shift 2",
      "  phonecando_try=1",
      "  while :; do",
      "    set +e",
      "    (set -e; \"\$@\")",
      "    phonecando_status=\$?",
      "    set -e",
      "    if [ \"\$phonecando_status\" -eq 0 ]; then return 0; fi",
      "    if [ \"\$phonecando_try\" -ge \"\$phonecando_max\" ]; then exit \"\$phonecando_status\"; fi",
      "    phonecando_try=\$((phonecando_try + 1))",
      "    echo \"@retry \$phonecando_phase \$phonecando_try/\$phonecando_max\"",
      "    sleep \$((phonecando_try * 5 - 5))",
      "  done",
      "}",
    )
  }
}
