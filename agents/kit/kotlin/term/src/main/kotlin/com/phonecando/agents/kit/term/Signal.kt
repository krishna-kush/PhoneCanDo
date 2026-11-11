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

  /** OSC 7501, a Program Status Protocol report the spec keeps: [text] is the report as ProgramStatus.parse words it. */
  data class Status(val text: String) : Signal

  /** OSC 7501 ; ? : the program asks whether the terminal speaks that protocol; [bel] when the query ended with BEL. */
  data class StatusQuery(val bel: Boolean) : Signal

  /** CSI 2 J: the whole screen erased. */
  data object FullClear : Signal

  /** ESC c (RIS): the terminal reset to its defaults. */
  data object Reset : Signal

  /** The alternate screen entered or left (CSI ? 1049, 1047 or 47, h or l). */
  data class AltScreen(val enter: Boolean) : Signal

  /** DEC private modes set or reset (CSI ? Pm h / l); an AltScreen comes first when one of them is. */
  data class Modes(val modes: List<Int>, val set: Boolean) : Signal

  /**
   * A colour asked for (`?` in OSC 4, 10, 11 or 12): [osc] is the command
   * (an OSC 10 field after the first asks for 11, then 12), [index] the
   * palette entry for OSC 4; [bel] when the query ended with BEL. One
   * sequence may ask for several.
   */
  data class ColorQuery(val osc: Int, val index: Int?, val bel: Boolean) : Signal

  /** CSI ? 996 n: is the theme dark or light (TermTheme.report). */
  data object ThemeQuery : Signal

  /** CSI c or CSI 0 c: primary device attributes. Programs send it after other queries, as a fence. */
  data object DeviceAttributesQuery : Signal

  /** CSI 5 n: the operating status report (DSR). */
  data object OperatingStatusQuery : Signal
}
