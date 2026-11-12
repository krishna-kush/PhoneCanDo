package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.lreNet
import com.phonecando.network.CancelSignal
import com.phonecando.network.retry.RetryPolicy
import com.phonecando.network.retry.Waits

/**
 * Runs one registry operation against a list of sources: retries a host
 * while network's rule says another try may go through (a dropped
 * connection, a 5xx), with [retry]'s pauses; moves on at once on 429 (its
 * window is an hour), and treats "not found" as final only from the
 * image's own registry (a mirror may just not carry it). Content errors
 * (bad digest, no arm64, corrupt JSON) are final everywhere. Network's
 * errors become lre's here.
 *
 * When every source fails we report the most telling cause: rate limited,
 * then a network failure, then not found.
 */
internal class SourceFallback(private val retry: RetryPolicy, private val sleeper: (Long) -> Unit) {
    fun <T> run(sources: List<RegistrySource>, cancel: CancelSignal, op: (RegistrySource) -> T): T {
        var rateLimited: LreException.RateLimited? = null
        var network: LreException.Network? = null
        var notFound: LreException.NotFound? = null
        for (source in sources) {
            var failures = 0
            while (true) {
                if (cancel.isCancelled()) throw LreException.Cancelled()
                try {
                    return lreNet { op(source) }
                } catch (e: LreException.RateLimited) {
                    rateLimited = rateLimited ?: e
                    break
                } catch (e: LreException.NotFound) {
                    if (source.primary) throw e
                    notFound = notFound ?: e
                    break
                } catch (e: LreException.Network) {
                    network = e
                    if (!RetryPolicy.retryable(e)) break
                    failures++
                    val delay = retry.delayMillis(failures, e) ?: break
                    lreNet { Waits.sleep(delay, cancel, sleeper) }
                }
            }
        }
        throw rateLimited ?: network ?: notFound ?: LreException.NotFound("a registry to pull from")
    }

    companion object {
        /** Three tries per host, 1 s and then 2 s apart, before the next source. */
        val PER_HOST = RetryPolicy(listOf(1_000L, 2_000L))
    }
}
