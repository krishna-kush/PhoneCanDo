package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState
import org.json.JSONObject

// The records on file:
//   {"version":1,"kinds":{"<kindId>":{"<capability>":{"state":"checked|failed",
//     "key","cliVersion","at","agentId","code"?,"detail"?,"notified"?}}}}
// A record that does not read whole (an unknown capability or state, no
// key) is left out; another version, or text that is no JSON, reads as
// none. Pure (org.json ships with Android; the tests add it).
internal object CheckJson {
  const val VERSION = 1

  fun encode(kinds: Map<String, Map<Capability, Stored>>): String {
    val all = JSONObject()
    for ((kindId, records) in kinds) {
      val kind = JSONObject()
      for ((capability, stored) in records) kind.put(capability.wire, record(stored))
      all.put(kindId, kind)
    }
    return JSONObject().put("version", VERSION).put("kinds", all).toString()
  }

  fun decode(text: String): Map<String, Map<Capability, Stored>> {
    val root = try {
      JSONObject(text)
    } catch (_: Exception) {
      return emptyMap()
    }
    if (root.optInt("version") != VERSION) return emptyMap()
    val all = root.optJSONObject("kinds") ?: return emptyMap()
    val out = HashMap<String, Map<Capability, Stored>>()
    for (kindId in all.keys()) {
      val kind = all.optJSONObject(kindId) ?: continue
      val records = HashMap<Capability, Stored>()
      for (wire in kind.keys()) {
        val capability = Capability.of(wire) ?: continue
        record(kind.optJSONObject(wire) ?: continue)?.let { records[capability] = it }
      }
      if (records.isNotEmpty()) out[kindId] = records
    }
    return out
  }

  private fun record(s: Stored): JSONObject {
    val r = s.record
    return JSONObject()
      .put("state", r.state.wire)
      .put("key", r.key)
      .put("cliVersion", r.cliVersion)
      .put("at", r.at)
      .put("agentId", r.agentId)
      .put("code", r.code ?: JSONObject.NULL)
      .put("detail", r.detail ?: JSONObject.NULL)
      .put("notified", s.notified ?: JSONObject.NULL)
  }

  private fun record(o: JSONObject): Stored? {
    val state = CheckState.of(o.optString("state")).takeIf { it == CheckState.CHECKED || it == CheckState.FAILED } ?: return null
    val key = o.optString("key").takeIf { it.isNotEmpty() } ?: return null
    val record = CheckRecord(
      state = state,
      key = key,
      cliVersion = o.optString("cliVersion"),
      at = o.optLong("at", 0L),
      agentId = o.optString("agentId"),
      code = text(o, "code"),
      detail = text(o, "detail"),
    )
    return Stored(record, text(o, "notified"))
  }

  private fun text(o: JSONObject, name: String): String? = if (o.isNull(name)) null else o.optString(name).takeIf { it.isNotEmpty() }
}
