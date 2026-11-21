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
import kotlinx.coroutines.currentCoroutineContext

// The PCE's backend under the app check of the bridge call it runs for
// (appaccess/AppGate, carried down the call's coroutine as AppGateCall), so
// a tap's expect, a wait and every step of a pack are judged like the call
// itself: a look by the app it shows, a launch by the app it opens, any
// other action by the app in front. A refused look or action never runs
// and ends the call with an error the router swaps for that app's refusal.
// A call with no gate (lite, play, the app's own) passes untouched.
@OptIn(ExperimentalPceApi::class)
class AppGatedBackend(
  private val inner: Backend,
  private val front: () -> String?,
) : Backend {
  override val id: String get() = inner.id
  override val capabilities get() = inner.capabilities

  override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
    val gate = gate() ?: return inner.observe(options)
    return when (val raw = inner.observe(options)) {
      is PceResult.Err -> raw
      is PceResult.Ok -> if (gate.allows(raw.value.packageName)) raw else refused()
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
