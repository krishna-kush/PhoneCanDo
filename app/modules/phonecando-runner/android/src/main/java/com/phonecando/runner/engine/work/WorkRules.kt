package com.phonecando.runner.engine.work

// Every number job detection and the idle stop use, in one place.
//
// - a look every POLL_MS while an engine runs (WorkWatch)
// - a process younger than MIN_AGE_MS is not work yet: hooks, `git status`
//   and spawn helpers come and go
// - a job is active (the CPU stays awake for it, power/WorkLock) when the
//   agent's jobs used ACTIVE_CPU_MS of CPU or moved ACTIVE_IO_BYTES since
//   the last look, and stays so for ACTIVE_HOLD_MS after
// - an agent whose kind has no idle rule counts DEFAULT_QUIET_MS as quiet
object WorkRules {
  const val POLL_MS = 30_000L
  const val MIN_AGE_MS = 10_000L

  const val ACTIVE_CPU_MS = 200L
  const val ACTIVE_IO_BYTES = 64L * 1024L
  const val ACTIVE_HOLD_MS = 60_000L

  const val DEFAULT_QUIET_MS = 60_000L

  /** What a command line's first word is when it is a shell. */
  val SHELLS = setOf("sh", "bash", "zsh", "dash", "ash", "ksh", "mksh", "fish", "tcsh", "csh", "yash")

  /**
   * Our own runtime's binaries (lre's PayloadNames: LAUNCHER, PROOT): the
   * launcher behind the machine's command shims, which answers to the
   * command's name ("bash" too), and proot. They carry a command into the
   * machine; job detection judges them by what runs under them. Never
   * proot's loader: every guest runs that.
   */
  val RUNTIME_EXES = setOf("libphonecando_launch.so", "libproot.so")
}
