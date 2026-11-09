package com.phonecando.agents.kit.term

/** Something a terminal program said in its output stream (SignalScanner). */
sealed interface Signal {
  /** BEL outside any escape sequence. */
  data object Bell : Signal

  /** OSC 0 or 2: the window title. */
  data class Title(val text: String) : Signal

  /** OSC 9 (not 9;4), a notification: [text] follows `9;`. */
  data class Osc9(val text: String) : Signal

  /** OSC 9;4 progress: [text] follows `9;4;` (state;value). */
  data class Progress(val text: String) : Signal

  /** OSC 777;notify: [text] follows `777;notify;` (title;body). */
  data class Osc777(val text: String) : Signal

  /** CSI 2 J: the whole screen erased. */
  data object FullClear : Signal

  /** ESC c (RIS): the terminal reset to its defaults. */
  data object Reset : Signal

  /** The alternate screen entered or left (CSI ? 1049, 1047 or 47, h or l). */
  data class AltScreen(val enter: Boolean) : Signal

  /** DEC private modes set or reset (CSI ? Pm h / l); an AltScreen comes first when one of them is. */
  data class Modes(val modes: List<Int>, val set: Boolean) : Signal
}
