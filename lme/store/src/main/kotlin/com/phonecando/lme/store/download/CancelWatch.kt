package com.phonecando.lme.store.download

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.http.HttpResponse
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Aborts a response once its download is cancelled. A read on a stalled
 * connection blocks until the port's read timeout; without this a pause
 * would wait that long. One shared daemon thread checks every [EVERY_MS].
 */
internal object CancelWatch {
    private const val EVERY_MS = 250L

    private val timer = Executors.newSingleThreadScheduledExecutor { task ->
        Thread(task, "lme-cancel-watch").apply { isDaemon = true }
    }

    /** Watches [cancel] for [response] until the returned handle is closed. */
    fun abortOnCancel(cancel: CancelSignal, response: HttpResponse): AutoCloseable {
        val aborted = AtomicBoolean(false)
        val check = timer.scheduleWithFixedDelay(
            { if (cancel.isCancelled() && aborted.compareAndSet(false, true)) response.abort() },
            EVERY_MS,
            EVERY_MS,
            TimeUnit.MILLISECONDS,
        )
        return AutoCloseable { check.cancel(false) }
    }
}
