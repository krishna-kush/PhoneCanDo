package com.phonecando.lme.host.ram

/**
 * Every number the RAM gate uses, in one place (the table in
 * `RamGateTest` pins them):
 *
 * - local models are offered from a 6 GB phone up, with a warning below 8 GB
 * - a model may take at most half the phone's RAM (the budget): its files
 *   plus its KV cache at the planned context; the rest is Android's, the
 *   agent's and the other apps'
 * - what it may take at a start is also bounded by the memory free then
 *   (`MemoryInfo.availMem`) less [FREE_MARGIN_MIB], kept for the agent's
 *   own engine and so Android does not run short: that bound sizes the
 *   automatic context and the server's prompt cache, never a verdict
 * - a context the user chose may pass the budget (with a warning), never
 *   the phone's total RAM
 *
 * Phones are sold by marketed size (8 GB) but report less as total RAM
 * (7.2 GiB on our 8 GB test phone: the kernel and firmware keep some), so
 * the floor and the warning compare the marketed size ([RamClass]); the
 * budget uses the real total.
 */
object RamRules {
    const val OFFERED_FROM_GB = 6
    const val WARN_BELOW_GB = 8
    const val BUDGET_PERCENT = 50
    const val FREE_MARGIN_MIB = 512L

    /** Marketed RAM sizes in GB, smallest first. */
    val MARKETED_GB = listOf(1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24, 32, 48, 64)
}
