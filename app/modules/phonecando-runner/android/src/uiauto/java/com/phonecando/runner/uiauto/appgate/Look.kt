package com.phonecando.runner.uiauto.appgate

import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.runner.appaccess.AppGate
import com.phonecando.runner.appaccess.ForeignParts

// One look as an agent may see it (appaccess/ForeignParts, AppGate): the
// parts of other apps found in the window and where each sits (a tap that
// lands on one the agent may not see is refused), the snapshot without the
// ones it may not see, each with everything below it, and whether any was
// left out (then no screenshot: its pixels would show them).
@OptIn(ExperimentalPceApi::class)
internal class Look(
  val snapshot: RawSnapshot,
  private val parts: List<Pair<Bounds, ForeignParts.Part>>,
  private val bounds: Map<BackendNodeId, Bounds>,
  val leftOut: Boolean,
) {
  fun partsAt(point: Point): List<ForeignParts.Part> = parts.filter { it.first.contains(point) }.map { it.second }

  fun centreOf(node: BackendNodeId): Point? = bounds[node]?.center

  fun withoutShot() = Look(snapshot.copy(screenshot = null), parts, bounds, leftOut)

  companion object {
    fun of(raw: RawSnapshot, gate: AppGate, named: (label: String) -> List<String>): Look {
      val seen = raw.nodes.map { ForeignParts.Seen(it.backendId.value, it.parentBackendId?.value, it.packageName, it.viewId, it.text) }
      val parts = ForeignParts.find(seen, named)
      val hidden = parts.filterNot(gate::mayShow).onEach(gate::hid)
      val dropped = ForeignParts.under(seen, hidden.map { it.root }.toSet())
      val byId = raw.nodes.associateBy { it.backendId.value }
      val shown = if (dropped.isEmpty()) {
        raw
      } else {
        raw.copy(
          nodes = raw.nodes.filterNot { it.backendId.value in dropped },
          focusedBackendNodeId = raw.focusedBackendNodeId?.takeUnless { it.value in dropped },
        )
      }
      return Look(
        shown,
        parts.mapNotNull { part -> byId[part.root]?.let { it.bounds to part } },
        raw.nodes.associate { it.backendId to it.bounds },
        leftOut = hidden.isNotEmpty(),
      )
    }
  }
}
