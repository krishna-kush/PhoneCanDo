package com.phonecando.runner.uiauto

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.WindowType
import com.phonecando.pce.api.map
import com.phonecando.runner.uiauto.overlay.OverlayGuard

// The PCE's backend as the agent should meet it, with our driving overlay
// (overlay/DrivingOverlay) never in its way. A screenshot is taken with the
// overlay hidden. A tap, long press or swipe is a touch on the screen that
// lands on whatever window is on top (the backend taps even a node by its
// centre first), so it runs with the pill letting touches through; typing,
// keys, scrolls and launches never touch the screen. Our own overlay windows
// never show in a snapshot's window list.
@OptIn(ExperimentalPceApi::class)
class GuardedBackend(
  private val inner: Backend,
  private val overlay: OverlayGuard,
  private val ownPackage: String,
) : Backend {
  override val id: String get() = inner.id
  override val capabilities get() = inner.capabilities

  override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
    val raw = if (options.screenshot) overlay.hidden { inner.observe(options) } else inner.observe(options)
    return raw.map { snapshot ->
      snapshot.copy(windows = snapshot.windows.filterNot { it.type == WindowType.ACCESSIBILITY_OVERLAY && it.packageName == ownPackage })
    }
  }

  override suspend fun execute(action: BackendAction): PceResult<Unit> = when (action) {
    is BackendAction.Tap, is BackendAction.LongPress, is BackendAction.Swipe -> overlay.touchThrough { inner.execute(action) }
    else -> inner.execute(action)
  }

  override suspend fun close() = inner.close()
}
