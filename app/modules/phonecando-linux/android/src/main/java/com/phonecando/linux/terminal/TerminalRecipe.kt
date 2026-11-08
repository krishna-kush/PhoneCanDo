package com.phonecando.linux.terminal

import com.phonecando.lre.api.ImageLayout
import java.io.File

/**
 * What the terminal tab runs on our PTY (PtyRecipe in the JS types): argv,
 * env over the app's, cwd, and whether the program hands the terminal on.
 */
data class TerminalRecipe(
  val cmd: List<String>,
  val env: Map<String, String>,
  val cwd: String,
  val handOver: Boolean,
) {
  fun toMap(): Map<String, Any> = mapOf("cmd" to cmd, "env" to env, "cwd" to cwd, "handOver" to handOver)

  companion object {
    /**
     * A login shell inside a Linux image. shims/bash is a link to our
     * launcher, which runs bash in the guest (launch.conf maps it to the
     * guest's /bin/sh when there is no bash). HOME is the guest's /root,
     * where home/ is bound.
     *
     * cwd is run/ on purpose: the launcher keeps the current dir as the
     * guest cwd only when it lies under a `same` path (home/ and tmp/ under
     * each data-dir spelling) and otherwise starts in the `home` directive,
     * /root. Starting in home/ itself would show the long host spelling of
     * that dir as the prompt's cwd instead of ~.
     *
     * TMPDIR is the guest's /tmp (tmp/ is bound there): our PTY passes the
     * app's own environment on, whose TMPDIR is the app's cache dir, which
     * the guest cannot see.
     *
     * The PTY opens as no session's terminal (handOver) and the launcher
     * hands it to the shell (lre/launcher standin.c), so the shell is its
     * controlling process as on a PC: job control works, and closing the
     * terminal hangs the shell up, which hangs up its jobs; nohup'd and
     * disowned ones run on. The launcher can't let go of a terminal it
     * holds: Android denies apps TIOCNOTTY.
     *
     * PHONECANDO_AGENT is never set: an engine start reaps every process
     * carrying that tag, and the terminal is not an engine.
     */
    fun linux(layout: ImageLayout): TerminalRecipe = TerminalRecipe(
      cmd = listOf(File(layout.shims, "bash").path, "-l"),
      env = mapOf(
        "PHONECANDO_IMAGE" to layout.root.path,
        "HOME" to "/root",
        "TMPDIR" to "/tmp",
        "TERM" to TERM,
        "COLORTERM" to COLORTERM,
        "LANG" to "C.UTF-8",
      ),
      cwd = layout.run.path,
      handOver = true,
    )

    /**
     * Android's shell in an image with no Linux: HOME and TMPDIR are the
     * image's home/ and tmp/. It keeps the terminal itself: mksh doesn't
     * take one it is handed.
     */
    fun android(layout: ImageLayout): TerminalRecipe = TerminalRecipe(
      cmd = listOf("/system/bin/sh", "-l"),
      env = mapOf(
        "HOME" to layout.home.path,
        "TMPDIR" to layout.tmp.path,
        "TERM" to TERM,
        "COLORTERM" to COLORTERM,
      ),
      cwd = layout.home.path,
      handOver = false,
    )

    private const val TERM = "xterm-256color"
    private const val COLORTERM = "truecolor"
  }
}
