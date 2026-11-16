package com.phonecando.runner.cutoff

import com.phonecando.runner.schedule.StateFile
import org.json.JSONArray
import org.json.JSONObject

/** What the file holds: the runs going or cut off, and per agent when it was brought back (BringRules). */
data class CutOffBook(
  val runs: List<CutOffRun> = emptyList(),
  val brought: Map<String, List<Long>> = emptyMap(),
)

// files/state/cut-off-runs.json: {runs: [CutOffRun], brought: {agentId:
// [epoch ms]}}, written whole and atomically, synced to the disk
// (StateFile), so it is there after a reboot or a kill. A run that does
// not read is left out; a file that does not read is empty. Plain JVM IO.
class CutOffStore(private val file: StateFile) {
  fun load(): CutOffBook {
    val o = try {
      file.read()?.let(::JSONObject)
    } catch (_: Exception) {
      null
    } ?: return CutOffBook()
    val runs = o.optJSONArray("runs")?.let { a ->
      (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let(CutOffRun::of) }
    }.orEmpty()
    val brought = o.optJSONObject("brought")?.let { b ->
      b.keys().asSequence().associateWith { id ->
        b.optJSONArray(id)?.let { t -> (0 until t.length()).map { t.optLong(it) }.filter { it > 0 } }.orEmpty()
      }.filterValues { it.isNotEmpty() }
    }.orEmpty()
    return CutOffBook(runs, brought)
  }

  fun save(book: CutOffBook) {
    val brought = JSONObject()
    for ((id, times) in book.brought) brought.put(id, JSONArray(times))
    file.write(
      JSONObject()
        .put("runs", JSONArray(book.runs.map { it.toJson() }))
        .put("brought", brought)
        .toString(),
    )
  }
}
