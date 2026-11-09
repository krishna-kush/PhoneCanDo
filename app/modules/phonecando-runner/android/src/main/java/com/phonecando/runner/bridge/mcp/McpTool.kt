package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.Route
import org.json.JSONObject

// One phone tool as /mcp serves it, from the generated table
// (agents/shared/phone-tools/tools.json, gen-tools-json.mjs): the name,
// description and input schema the TS tools register, and the one bridge
// route their `run` calls with the fields it always sends (`body`). Pure.
class McpTool(
  val name: String,
  val description: String,
  val inputSchema: JSONObject,
  val route: Route,
  private val fixed: JSONObject,
) {
  // The route's body: the fixed fields, then each argument the schema
  // names, as the TS run passes them. A null argument counts as absent,
  // so a fixed field keeps its value (the TS `args.tab ?? "home"`).
  fun body(arguments: JSONObject): JSONObject {
    val out = JSONObject(fixed.toString())
    val known = inputSchema.optJSONObject("properties")
    for (key in arguments.keys()) {
      val value = arguments.opt(key)
      if (known?.has(key) == true && value != null && value != JSONObject.NULL) out.put(key, value)
    }
    return out
  }

  fun listing(): JSONObject =
    JSONObject().put("name", name).put("description", description).put("inputSchema", inputSchema)
}

object McpTools {
  /** Where agents.gradle packages the table. */
  const val ASSET = "agents/shared/phone-tools/tools.json"
  private const val SCHEMA = 1

  // The tools this build serves: full gets every one, lite and play the
  // `all` ones (the TS adapters register the same split). A tool whose
  // method and route this bridge lacks is left out through `skipped`.
  fun parse(
    text: String,
    full: Boolean,
    skipped: (name: String, why: String) -> Unit = { _, _ -> },
  ): List<McpTool> {
    val table = JSONObject(text)
    require(table.optInt("schema") == SCHEMA) { "tools.json schema ${table.opt("schema")}, expected $SCHEMA" }
    val tools = table.getJSONArray("tools")
    return (0 until tools.length()).mapNotNull { i ->
      val t = tools.getJSONObject(i)
      val name = t.getString("name")
      if (t.optString("channel") == "full" && !full) return@mapNotNull null
      val route = Route.find(t.getString("method"), t.getString("route"))
      if (route == null) {
        skipped(name, "no route ${t.getString("method")} ${t.getString("route")}")
        return@mapNotNull null
      }
      McpTool(name, t.getString("description"), t.getJSONObject("inputSchema"), route, t.optJSONObject("body") ?: JSONObject())
    }
  }
}
