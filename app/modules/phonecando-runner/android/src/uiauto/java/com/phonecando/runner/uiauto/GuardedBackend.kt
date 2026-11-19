package com.phonecando.runner.uiauto

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.WindowType
import com.phonecando.pce.api.map
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.uiauto.overlay.OverlayGuard
import kotlinx.coroutines.withTimeoutOrNull

// The PCE's backend as the agent should meet it, with our glass (the
// agent's mascot, overlay/GlassOverlay) never in its way. A screenshot is
// taken with the glass hidden. A tap, long press or swipe is a touch on the
// screen that lands on whatever window is on top (the backend taps even a
// node by its centre first), so it runs with the glass letting touches
// through, told first where it lands so the mascot can look there and move
// out of the way: a node's spot is its centre in the last snapshot. Typing,
// keys, scrolls and launches never touch the screen. Our own overlay
// windows never show in a snapshot's window list.
//
// A touch that Android never reports back on (you touched the screen
// yourself while it ran) gives up after its own length and a margin: it
// must never keep the agent's request open, the screen counted as in use
// and the glass letting touches through, for good.
@OptIn(ExperimentalPceApi::class)
class GuardedBackend(
  private val inner: Backend,
  private val overlay: OverlayGuard,
  private val ownPackage: String,
) : Backend {
  override val id: String get() = inner.id
  override val capabilities get() = inner.capabilities

  // The last snapshot's node centres, for where a tap on a node lands.
  @Volatile private var centres: Map<BackendNodeId, Point> = emptyMap()

  override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
    val raw = if (options.screenshot) overlay.hidden { inner.observe(options) } else inner.observe(options)
    return raw.map { snapshot ->
      centres = snapshot.nodes.associate { it.backendId to it.bounds.center }
      snapshot.copy(windows = snapshot.windows.filterNot { it.type == WindowType.ACCESSIBILITY_OVERLAY && it.packageName == ownPackage })
    }
  }

  override suspend fun execute(action: BackendAction): PceResult<Unit> = when (action) {
    is BackendAction.Tap -> touch(spot(action.point, action.backendNodeId), 0, action)
    is BackendAction.LongPress -> touch(spot(action.point, action.backendNodeId), action.durationMs, action)
    is BackendAction.Swipe -> touch(listOf(pt(action.from), pt(action.to)), action.durationMs, action)
    else -> inner.execute(action)
  }

  private suspend fun touch(path: List<Pt>, ms: Long, action: BackendAction): PceResult<Unit> =
    overlay.touchThrough(path) {
      withTimeoutOrNull(ms.coerceAtLeast(0) + TOUCH_MARGIN_MS) { inner.execute(action) }
        ?: PceResult.Err(PceError(ErrorCode.TIMEOUT, "the touch was never reported back (did someone touch the screen?); observe and try again"))
    }

  private fun spot(point: Point?, node: BackendNodeId?): List<Pt> = listOfNotNull((point ?: node?.let { centres[it] })?.let(::pt))

  private fun pt(p: Point) = Pt(p.x.toFloat(), p.y.toFloat())

  override suspend fun close() = inner.close()

  private companion object {
    const val TOUCH_MARGIN_MS = 5_000L
  }
}
