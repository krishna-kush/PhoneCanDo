package com.phonecando.agents.kit.term

import java.io.ByteArrayOutputStream

// A terminal program's output, byte by byte, to the Signals in it: bells,
// window titles, OSC 9 / 9;4 / 777 notices, full clears, resets and DEC
// private modes (the alternate screen among them). It parses the escape
// sequences xterm.js does (ESC, CSI, OSC, DCS/APC/PM/SOS strings) far
// enough to know where each one ends, so a sequence split across reads is
// still one sequence and a BEL that ends an OSC is no bell. 8-bit C1 codes
// are text: in UTF-8 they are continuation bytes. Pure; one per stream.
class SignalScanner {
  private enum class State { GROUND, ESC, ESC_INTER, CSI, OSC, STRING }

  private var state = State.GROUND

  /** Bytes consumed so far. */
  var position = 0L
    private set

  /** Where the sequence being read (or the one just ended) began; read it while a Signal is handed out. */
  var sequenceStart = 0L
    private set

  // UTF-8 continuation bytes still due for the character in progress.
  private var utf8Due = 0

  private val params = StringBuilder()
  // A CSI too long, or with an intermediate byte: none we read, so it says nothing.
  private var ignoreCsi = false
  private var privateMarker = false
  private val osc = ByteArrayOutputStream()
  private var oscOverflow = false

  /** True between whole sequences and whole characters: a stream cut here replays cleanly. */
  val atBoundary: Boolean get() = state == State.GROUND && utf8Due == 0

  fun feed(bytes: ByteArray, off: Int = 0, len: Int = bytes.size - off, out: (Signal) -> Unit) {
    for (i in off until off + len) step(bytes[i], out)
  }

  fun step(byte: Byte, out: (Signal) -> Unit) {
    val b = byte.toInt() and 0xff
    position++
    when (state) {
      State.GROUND -> ground(b, out)
      State.ESC -> escape(b, out)
      State.ESC_INTER -> when {
        b == ESC -> enterEscape()
        b == CAN || b == SUB -> state = State.GROUND
        b in 0x30..0x7e -> state = State.GROUND
        b == BEL -> out(Signal.Bell)
      }
      State.CSI -> csi(b, out)
      State.OSC -> when (b) {
        BEL -> endOsc(out, next = State.GROUND)
        ESC -> {
          // ESC ends the string (ST is ESC \); what follows is a new escape.
          endOsc(out, next = State.ESC)
          sequenceStart = position - 1
        }
        CAN, SUB -> state = State.GROUND
        else -> collectOsc(b)
      }
      // A DCS, APC, PM or SOS string: only ST (ESC \), CAN or SUB end it; a BEL in it is data.
      State.STRING -> when (b) {
        ESC -> enterEscape()
        CAN, SUB -> state = State.GROUND
      }
    }
  }

  private fun ground(b: Int, out: (Signal) -> Unit) {
    when {
      b == ESC -> {
        utf8Due = 0
        enterEscape()
      }
      b == BEL -> {
        utf8Due = 0
        out(Signal.Bell)
      }
      b < 0x80 -> utf8Due = 0
      b < 0xc0 -> if (utf8Due > 0) utf8Due--
      b < 0xe0 -> utf8Due = 1
      b < 0xf0 -> utf8Due = 2
      b < 0xf8 -> utf8Due = 3
      else -> utf8Due = 0
    }
  }

  private fun enterEscape() {
    state = State.ESC
    sequenceStart = position - 1
  }

  private fun escape(b: Int, out: (Signal) -> Unit) {
    when (b) {
      '['.code -> {
        state = State.CSI
        params.setLength(0)
        ignoreCsi = false
        privateMarker = false
      }
      ']'.code -> {
        state = State.OSC
        osc.reset()
        oscOverflow = false
      }
      'P'.code, '_'.code, '^'.code, 'X'.code -> state = State.STRING
      'c'.code -> {
        state = State.GROUND
        out(Signal.Reset)
      }
      ESC -> enterEscape()
      CAN, SUB -> state = State.GROUND
      BEL -> out(Signal.Bell)
      else -> state = when (b) {
        in 0x20..0x2f -> State.ESC_INTER
        in 0x30..0x7e -> State.GROUND
        else -> state // other C0 controls run without ending the escape
      }
    }
  }

  private fun csi(b: Int, out: (Signal) -> Unit) {
    when {
      b == ESC -> enterEscape()
      b == CAN || b == SUB -> state = State.GROUND
      b == BEL -> out(Signal.Bell)
      b < 0x20 -> {} // C0 controls run inside a CSI
      b in 0x30..0x3f -> {
        if (b == '?'.code && params.isEmpty() && !privateMarker) {
          privateMarker = true
        } else if (params.length < MAX_PARAMS) {
          params.append(b.toChar())
        } else {
          ignoreCsi = true
        }
      }
      b in 0x20..0x2f -> ignoreCsi = true
      b in 0x40..0x7e -> {
        state = State.GROUND
        if (!ignoreCsi) dispatchCsi(b.toChar(), out)
      }
      b == DEL -> {}
      else -> state = State.GROUND
    }
  }

  private fun dispatchCsi(final: Char, out: (Signal) -> Unit) {
    val text = params.toString()
    when {
      privateMarker && (final == 'h' || final == 'l') -> {
        val modes = text.split(';').mapNotNull { it.toIntOrNull() }
        if (modes.isEmpty()) return
        val set = final == 'h'
        if (modes.any { it in ALT_SCREEN_MODES }) out(Signal.AltScreen(set))
        out(Signal.Modes(modes, set))
      }
      !privateMarker && final == 'J' && text == "2" -> out(Signal.FullClear)
    }
  }

  private fun collectOsc(b: Int) {
    if (osc.size() < MAX_OSC_BYTES) osc.write(b) else oscOverflow = true
  }

  private fun endOsc(out: (Signal) -> Unit, next: State) {
    state = next
    if (oscOverflow) return
    val text = osc.toString(Charsets.UTF_8)
    val semi = text.indexOf(';')
    if (semi < 0) return
    val body = text.substring(semi + 1)
    val signal = when (text.substring(0, semi)) {
      "0", "2" -> Signal.Title(body)
      "9" -> if (body.startsWith("4;")) Signal.Progress(body.substring(2)) else Signal.Osc9(body)
      "777" -> body.takeIf { it.startsWith(NOTIFY) }?.let { Signal.Osc777(it.substring(NOTIFY.length)) }
      else -> null
    }
    signal?.let(out)
  }

  companion object {
    private const val BEL = 0x07
    private const val ESC = 0x1b
    private const val CAN = 0x18
    private const val SUB = 0x1a
    private const val DEL = 0x7f
    private const val NOTIFY = "notify;"

    // Longer ones are read to their end but say nothing.
    private const val MAX_OSC_BYTES = 4096
    private const val MAX_PARAMS = 64

    /** The DEC private modes that switch to the alternate screen. */
    val ALT_SCREEN_MODES = setOf(47, 1047, 1049)
  }
}
