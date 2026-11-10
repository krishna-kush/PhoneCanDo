package com.phonecando.runner.api

import android.content.Context
import android.util.Base64
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.tui.TerminalViewException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// A TUI engine's terminal for JS (the Home tab of a TUI-home agent): attach
// as its one viewer, read what it shows (first the replay of its screen,
// then live output), type, resize, say whether it is shown, detach; the
// engine runs on either way.
// Bytes cross as base64. Every call is synchronous and quick: reads never
// wait, a write gives up after about a second while the program does not
// read. Attach and read refuse with a CodedException whose code (also the
// start of its message) is not_running, ended or detached
// (TerminalViewException).
internal fun ModuleDefinitionBuilder.engineTerminalFunctions(context: () -> Context) {
  // { viewerId, rows, cols }: the PTY's size now. A new attach replaces the
  // last viewer, whose next read throws detached.
  Function("engineTerminalAttach") { agentId: String ->
    viewing {
      val attached = Engines.get(context()).attachTerminal(agentId)
      mapOf("viewerId" to attached.viewerId, "rows" to attached.rows, "cols" to attached.cols)
    }
  }

  // Base64 of up to [max] bytes, or null when nothing is pending. No
  // supervisor yet means this process never ran an engine: no view is ours.
  Function("engineTerminalRead") { viewerId: String, max: Int ->
    viewing {
      val viewers = Engines.peek()?.terminals ?: throw TerminalViewException(TerminalViewException.DETACHED, "no such view")
      viewers.read(viewerId, max.coerceIn(1, MAX_READ))?.let { Base64.encodeToString(it, Base64.NO_WRAP) }
    }
  }

  // From a view that was replaced, or after the end: nothing happens.
  Function("engineTerminalWrite") { viewerId: String, data: String ->
    Engines.peek()?.terminals?.write(viewerId, Base64.decode(data, Base64.DEFAULT))
  }

  Function("engineTerminalResize") { viewerId: String, rows: Int, cols: Int ->
    Engines.peek()?.terminals?.resize(viewerId, rows.coerceAtLeast(1), cols.coerceAtLeast(1))
  }

  // Whether the view shows the program (on screen, the app in front): the
  // program counts as focused only then (focus reports, DECSET 1004).
  Function("engineTerminalFocus") { viewerId: String, shown: Boolean ->
    Engines.peek()?.terminals?.focus(viewerId, shown)
  }

  Function("engineTerminalDetach") { viewerId: String ->
    Engines.peek()?.terminals?.detach(viewerId)
  }
}

private inline fun <T> viewing(block: () -> T): T = try {
  block()
} catch (e: TerminalViewException) {
  throw CodedException(e.code, e.message, e)
}

private const val MAX_READ = 64 * 1024
