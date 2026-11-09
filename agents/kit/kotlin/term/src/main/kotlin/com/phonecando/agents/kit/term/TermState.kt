package com.phonecando.agents.kit.term

// The terminal state a replay must set up before the output it replays:
// the alternate screen, cursor visibility (25), application cursor keys
// (DECCKM, 1), bracketed paste (2004), mouse reporting (1000, 1002, 1003,
// 1006) and the window title. Tracked from the Signals; prologue() resets
// the viewer's terminal (RIS), sets every mode that differs from the
// default and names the title, so a viewer that attaches late knows the
// chat at once. Pure.
class TermState private constructor(
  private var alt: Boolean,
  private val modes: MutableSet<Int>,
  private var title: String?,
) {
  constructor() : this(false, sortedSetOf(CURSOR), null)

  fun apply(signal: Signal) {
    when (signal) {
      is Signal.AltScreen -> alt = signal.enter
      is Signal.Modes -> for (mode in signal.modes) {
        if (mode !in TRACKED) continue
        if (signal.set) modes += mode else modes -= mode
      }
      is Signal.Title -> title = signal.text
      // A reset puts the modes back; the title is the window's, not the terminal's.
      Signal.Reset -> {
        alt = false
        modes.clear()
        modes += CURSOR
      }
      else -> {}
    }
  }

  fun copy() = TermState(alt, sortedSetOf<Int>().apply { addAll(modes) }, title)

  /** What a fresh terminal needs to be in this state. */
  fun prologue(): ByteArray {
    val out = StringBuilder(RIS)
    if (alt) out.append(csi(1049, true))
    if (CURSOR !in modes) out.append(csi(CURSOR, false))
    for (mode in modes) if (mode != CURSOR) out.append(csi(mode, true))
    title?.let { out.append("\u001b]2;").append(it).append('\u0007') }
    return out.toString().toByteArray(Charsets.UTF_8)
  }

  private fun csi(mode: Int, on: Boolean) = "\u001b[?$mode${if (on) 'h' else 'l'}"

  private companion object {
    const val RIS = "\u001bc"
    const val CURSOR = 25
    val TRACKED = setOf(1, CURSOR, 1000, 1002, 1003, 1006, 2004)
  }
}
