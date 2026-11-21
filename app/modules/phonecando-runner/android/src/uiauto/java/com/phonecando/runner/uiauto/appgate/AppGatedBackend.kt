package com.phonecando.runner.uiauto.appgate

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.runner.appaccess.AppGate
import com.phonecando.runner.appaccess.AppGate.Shot
import java.io.File
import kotlinx.coroutines.currentCoroutineContext

// The PCE's backend under the app check of the bridge call it runs for
// (appaccess/AppGate, carried down the call's coroutine as AppGateCall), so
// a tap's expect, a wait and every step of a pack are judged like the call
// itself: a look by the app it shows, a launch by the app it opens, any
// other action by the app in front. A screenshot is judged before it is
// taken (every app window on screen allowed, not the home screen) and
// again on what the look shows; one taken in a race is deleted at once, as
// agents can read the folder it lands in. A refused look or action never
// runs and ends the call with an error the router swaps for that app's
// refusal. A call with no gate (lite, play, the app's own) passes
// untouched.
@OptIn(ExperimentalPceApi::class)
class AppGatedBackend(
  private val inner: Backend,
  private val front: () -> String?,
  // The package of each app window on screen, null where Android can't say.
  private val appWindows: () -> List<String?>,
) : Backend {
  override val id: String get() = inner.id
  override val capabilities get() = inner.capabilities

  override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
    val gate = gate() ?: return inner.observe(options)
    if (!options.screenshot) {
      return when (val raw = inner.observe(options)) {
        is PceResult.Err -> raw
        is PceResult.Ok -> if (gate.allows(raw.value.packageName)) raw else refused()
      }
    }
    val before = gate.shot(front(), appWindows())
    if (before == Shot.REFUSE) return refused()
    val raw = when (val result = inner.observe(options.copy(screenshot = before == Shot.TAKE))) {
      is PceResult.Err -> return result
      is PceResult.Ok -> result.value
    }
    val taken = raw.screenshot ?: return if (gate.allows(raw.packageName)) PceResult.Ok(raw) else refused()
    return when (gate.shot(raw.packageName, appWindows())) {
      Shot.TAKE -> PceResult.Ok(raw)
      // The screen changed under the screenshot: it goes at once.
      Shot.WITHHOLD -> PceResult.Ok(raw.copy(screenshot = null)).also { File(taken.path).delete() }
      Shot.REFUSE -> refused<RawSnapshot>().also { File(taken.path).delete() }
    }
  }

  override suspend fun execute(action: BackendAction): PceResult<Unit> {
    val gate = gate() ?: return inner.execute(action)
    val app = if (action is BackendAction.Launch) action.packageName else front()
    return if (gate.allows(app)) inner.execute(action) else refused()
  }

  override suspend fun close() = inner.close()

  private suspend fun gate(): AppGate? = currentCoroutineContext()[AppGateCall]?.gate

  private fun <T> refused(): PceResult<T> =
    PceResult.Err(PceError(ErrorCode.CANCELLED, "stopped at an app agents may not use; the bridge names it"))
}
