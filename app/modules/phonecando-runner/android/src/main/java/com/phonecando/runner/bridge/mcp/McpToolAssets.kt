package com.phonecando.runner.bridge.mcp

import android.content.Context
import android.util.Log

// The packaged tool table (McpTools.ASSET). A build without it, or with a
// broken one, serves MCP with no tools; the HTTP routes are unaffected.
object McpToolAssets {
  private const val TAG = "PhoneCanDoBridge"

  fun load(context: Context, full: Boolean): List<McpTool> = try {
    val text = context.assets.open(McpTools.ASSET).use { it.readBytes().toString(Charsets.UTF_8) }
    McpTools.parse(text, full) { name, why -> Log.w(TAG, "mcp tool $name left out: $why") }
  } catch (e: Exception) {
    Log.w(TAG, "mcp tool table unreadable", e)
    emptyList()
  }
}
