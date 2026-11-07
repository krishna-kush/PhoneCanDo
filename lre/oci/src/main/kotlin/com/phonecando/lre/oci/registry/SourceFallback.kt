package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException

/**
 * Runs one registry operation against a list of sources: retries a host
 * on 5xx / dropped connections, moves on at once on 429, and treats
 * "not found" as final only from the image's own registry (a mirror may
 * just not carry it). Content errors (bad digest, no arm64, corrupt
 * JSON) are final everywhere.
 *
 * When every source fails we report the most telling cause: rate limited,
 * then a network failure, then not found.
 */
internal class SourceFallback(private val retry: RetryPolicy) {
    fun <T> run(sources: List<RegistrySource>, cancel: CancelSignal, op: (RegistrySource) -> T): T {
        var rateLimited: LreException.RateLimited? = null
        var network: LreException.Network? = null
        var notFound: LreException.NotFound? = null
        for (source in sources) {
            var attempt = 1
            while (true) {
                if (cancel.isCancelled()) throw LreException.Cancelled()
                try {
                    return op(source)
                } catch (e: LreException.RateLimited) {
                    rateLimited = rateLimited ?: e
                    break
                } catch (e: LreException.NotFound) {
                    if (source.primary) throw e
                    notFound = notFound ?: e
                    break
                } catch (e: LreException.Network) {
                    network = e
                    if (!retryable(e) || attempt >= retry.attemptsPerHost) break
                    retry.pause(attempt, cancel)
                    attempt++
                }
            }
        }
        throw rateLimited ?: network ?: notFound ?: LreException.NotFound("a registry to pull from")
    }

    /** No response, a 5xx, or a 408: worth another try on the same host. */
    private fun retryable(e: LreException.Network): Boolean {
        val status = e.status ?: return true
        return status == 408 || status >= 500
    }
}
