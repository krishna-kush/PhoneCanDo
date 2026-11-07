package com.phonecando.lre.image.proc

import java.io.File
import java.io.IOException

/**
 * The host's online CPU ids, as /proc/cpuinfo lists them (`processor : N`).
 * Android takes cores offline, which leaves gaps a plain count would hide.
 */
internal object CpuIds {
    private val PROCESSOR = Regex("^processor\\s*:\\s*(\\d+)\\s*$")

    /** Ids in [cpuinfo], sorted; empty when it has no `processor` lines. Pure. */
    fun parse(cpuinfo: String): List<Int> =
        cpuinfo.lineSequence().mapNotNull { PROCESSOR.find(it.trim())?.groupValues?.get(1)?.toIntOrNull() }
            .toSortedSet().toList()

    /** The live list, falling back to 0 until the processor count when cpuinfo says nothing. */
    fun host(cpuinfo: File = File("/proc/cpuinfo")): List<Int> {
        val parsed = try {
            parse(cpuinfo.readText())
        } catch (_: IOException) {
            emptyList()
        }
        return parsed.ifEmpty { (0 until Runtime.getRuntime().availableProcessors().coerceAtLeast(1)).toList() }
    }
}
