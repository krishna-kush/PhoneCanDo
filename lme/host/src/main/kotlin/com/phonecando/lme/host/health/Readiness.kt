package com.phonecando.lme.host.health

import com.phonecando.lme.api.LmeException
import com.phonecando.network.CancelSignal

/**
 * Waits for a started model server to answer ready: probes every
 * [pollMillis] until [Health.Ready], the process dies ([alive] false), the
 * server answers broken, or [timeoutMillis] pass. Loading a 4B model took
 * 27 s on our test phone; the default allows ten times that.
 */
class Readiness(
    private val probe: () -> Health,
    private val alive: () -> Boolean,
    private val clock: () -> Long = System::currentTimeMillis,
    private val sleep: (Long) -> Unit = Thread::sleep,
    private val timeoutMillis: Long = 300_000,
    private val pollMillis: Long = 500,
) {
    /** @throws LmeException.ServerNotReady with why; [LmeException.Cancelled] on [cancel]. */
    fun await(cancel: CancelSignal = CancelSignal.NEVER) {
        val start = clock()
        while (true) {
            if (cancel.isCancelled()) throw LmeException.Cancelled()
            when (val health = probe()) {
                Health.Ready -> return
                is Health.Failed -> throw LmeException.ServerNotReady("answered http ${health.status}")
                Health.Starting, Health.Loading -> Unit
            }
            if (!alive()) throw LmeException.ServerNotReady("the server exited")
            if (clock() - start >= timeoutMillis) throw LmeException.ServerNotReady("not ready after ${timeoutMillis / 1000} s")
            sleep(pollMillis)
        }
    }
}
