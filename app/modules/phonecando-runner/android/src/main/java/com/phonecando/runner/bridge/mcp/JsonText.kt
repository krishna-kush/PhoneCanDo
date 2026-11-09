package com.phonecando.runner.bridge.mcp

import org.json.JSONArray
import org.json.JSONObject

// Compact JSON as JavaScript's JSON.stringify writes it, for the text a tool
// returns over MCP: it then reads as the TS tools' does. Android's org.json
// escapes every `/`, which would turn a screenshot path into `\/data\/...`
// inside the text the model reads. Pure.
object JsonText {
  fun of(value: Any?): String = StringBuilder().also { write(it, value) }.toString()

  private fun write(out: StringBuilder, value: Any?) {
    when (value) {
      null, JSONObject.NULL -> out.append("null")
      is JSONObject -> {
        out.append('{')
        value.keys().asSequence().forEachIndexed { i, key ->
          if (i > 0) out.append(',')
          string(out, key)
          out.append(':')
          write(out, value.opt(key))
        }
        out.append('}')
      }
      is JSONArray -> {
        out.append('[')
        for (i in 0 until value.length()) {
          if (i > 0) out.append(',')
          write(out, value.opt(i))
        }
        out.append(']')
      }
      is Boolean -> out.append(value)
      is Number -> out.append(JSONObject.numberToString(value))
      else -> string(out, value.toString())
    }
  }

  private fun string(out: StringBuilder, s: String) {
    out.append('"')
    for (c in s) {
      when (c) {
        '"' -> out.append("\\\"")
        '\\' -> out.append("\\\\")
        '\n' -> out.append("\\n")
        '\r' -> out.append("\\r")
        '\t' -> out.append("\\t")
        '\b' -> out.append("\\b")
        '\u000C' -> out.append("\\f")
        else -> if (c < ' ') out.append("\\u%04x".format(c.code)) else out.append(c)
      }
    }
    out.append('"')
  }
}
