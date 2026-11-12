package com.phonecando.lme.catalog

import com.phonecando.network.http.RateLimitHeader

/**
 * How many of the Hub's API calls are left in its current window, as the
 * last answer's `RateLimit` header said (without a token the Hub sends
 * `q=500;w=300`: 500 calls per 5 minutes per address). A caller checks
 * [atLeast] before a request it can do without, so the ones the user asks
 * for keep their room. With nothing known (no answer yet, or the window it
 * said has ended) every request may go. Thread-safe; one per process
 * ([HfCatalog.callsLeft]).
 */
class HubCallsLeft(private val clock: () -> Long = System::currentTimeMillis) {
    private class Window(val calls: Int, val endsAtMs: Long)

    @Volatile
    private var window: Window? = null

    /** Takes in an answer's `RateLimit` header; one without the API's policy changes nothing. */
    fun note(header: String?) {
        val left = RateLimitHeader.policy(header, "api") ?: return
        window = Window(left.calls, clock() + left.resetSeconds * 1000)
    }

    /** True when at least [calls] are left in the window, or nothing is known. */
    fun atLeast(calls: Int): Boolean {
        val w = window ?: return true
        return clock() >= w.endsAtMs || w.calls >= calls
    }

    /**
     * Whole seconds until the window ends while the Hub says none are left
     * (its 429 says so too); null while calls may go.
     */
    fun cooldownSeconds(): Long? {
        val w = window ?: return null
        val waitMs = w.endsAtMs - clock()
        return if (w.calls == 0 && waitMs > 0) (waitMs + 999) / 1000 else null
    }

    /** Forgets what the Hub said: a token has a limit of its own. */
    fun forget() {
        window = null
    }
}
