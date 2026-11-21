package com.phonecando.runner.uiauto.appgate

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.runner.appaccess.AppGate
import com.phonecando.runner.appaccess.AppGate.Shot
import java.io.File
import kotlinx.coroutines.currentCoroutineContext

// The PCE's backend under the app check of the bridge call it runs for
// (appaccess/AppGate, carried down the call's coroutine as AppGateCall), so
// a tap's expect, a wait and every step of a pack are judged like the call
// itself: a look by the app it shows, a launch by the app it opens, any
// other action by the app in front. A look leaves out the parts of other
// apps the agent may not see (Look), and a tap, long press or swipe that
// starts on one is refused. A screenshot is taken only after the tree says
// it may be (no part left out, every app window on screen allowed, not the
// home screen) and is judged again on what it shows; one taken in a race
// is deleted at once, as agents can read the folder it lands in. A refused
// look or action never runs and ends the call with an error the router
// swaps for that app's refusal. A call with no gate (lite, play, the app's
// own) passes untouched.
@OptIn(ExperimentalPceApi::class)
class AppGatedBackend(
  private val inner: Backend,
  private val front: () -> String?,
  // The package of each app window on screen, null where Android can't say.
  private val appWindows: () -> List<String?>,
  // Every app with this name, for a notification row (appaccess/PhoneApps).
  private val named: (label: String) -> List<String>,
) : Backend {
  override val id: String get() = inner.id
  override val capabilities get() = inner.capabilities

  // The last look's parts and node spots, for where a touch lands.
  @Volatile private var last: Look? = null

  override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
    val gate = gate() ?: return inner.observe(options).also { last = null }
    // The tree first: what the agent may see decides whether a screenshot is taken at all.
    val tree = when (val raw = inner.observe(options.copy(screenshot = false))) {
      is PceResult.Err -> return raw
      is PceResult.Ok -> look(gate, raw.value) ?: return refused()
    }
    if (!options.screenshot) return done(tree)
    when (shot(gate, tree)) {
      Shot.REFUSE -> return refused()
      Shot.WITHHOLD -> return done(tree)
      Shot.TAKE -> {}
    }
    val raw = when (val result = inner.observe(options)) {
      is PceResult.Err -> return result
      is PceResult.Ok -> result.value
    }
    val taken = raw.screenshot
    val shown = look(gate, raw)
    if (taken == null || (shown != null && shot(gate, shown) == Shot.TAKE)) {
      if (shown == null) return refused()
      return done(shown)
    }
    // The screen changed under the screenshot: it goes at once.
    File(taken.path).delete()
    return if (shown == null || gate.refused != null) refused() else done(shown.withoutShot())
  }

  override suspend fun execute(action: BackendAction): PceResult<Unit> {
    val gate = gate() ?: return inner.execute(action)
    val app = if (action is BackendAction.Launch) action.packageName else front()
    if (!gate.allows(app)) return refused()
    val spot = landing(action) ?: return inner.execute(action)
    val parts = last?.partsAt(spot).orEmpty()
    return if (parts.all(gate::mayTap)) inner.execute(action) else refused()
  }

  override suspend fun close() = inner.close()

  private suspend fun gate(): AppGate? = currentCoroutineContext()[AppGateCall]?.gate

  // The look as the agent may see it, or null when its app is refused.
  private fun look(gate: AppGate, raw: RawSnapshot): Look? =
    if (gate.allows(raw.packageName)) Look.of(raw, gate, named) else null

  private fun shot(gate: AppGate, look: Look): Shot =
    if (look.leftOut) Shot.WITHHOLD else gate.shot(look.snapshot.packageName, appWindows())

  private fun done(look: Look): PceResult<RawSnapshot> {
    last = look
    return PceResult.Ok(look.snapshot)
  }

  // Where a touch lands: its point, or the centre of the node it taps.
  private fun landing(action: BackendAction): Point? = when (action) {
    is BackendAction.Tap -> action.point ?: action.backendNodeId?.let { last?.centreOf(it) }
    is BackendAction.LongPress -> action.point ?: action.backendNodeId?.let { last?.centreOf(it) }
    is BackendAction.Swipe -> action.from
    else -> null
  }

  private fun <T> refused(): PceResult<T> =
    PceResult.Err(PceError(ErrorCode.CANCELLED, "stopped at an app agents may not use; the bridge names it"))
}
