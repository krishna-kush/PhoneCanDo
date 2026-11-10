package com.phonecando.lme.host.cpu

import com.phonecando.lme.api.device.CpuCore

/**
 * How many threads to run on: the big cores. Little cores slow a matrix
 * multiply down to their pace, so we leave them out (on our 4 + 4 test
 * phone, 4 threads). Big means a `cpu_capacity` of at least half the
 * fastest core's; without capacities, a max frequency of at least 70% of
 * the fastest; without either, every core. Pure.
 */
object Threads {
    fun pick(cores: List<CpuCore>): Int {
        if (cores.isEmpty()) return 1
        val capacities = cores.mapNotNull { it.capacity }
        if (capacities.size == cores.size && capacities.max() > 0) {
            val max = capacities.max()
            return capacities.count { it * 2 >= max }
        }
        val freqs = cores.mapNotNull { it.maxFreqKhz }
        if (freqs.size == cores.size && freqs.max() > 0) {
            val max = freqs.max()
            return freqs.count { it * 10 >= max * 7 }
        }
        return cores.size
    }
}
