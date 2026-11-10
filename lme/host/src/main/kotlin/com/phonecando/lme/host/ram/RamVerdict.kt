package com.phonecando.lme.host.ram

/** The RAM gate's answer for one model on one phone, in bytes. */
sealed interface RamVerdict {
    /** The phone is below our floor: local models are not offered at all. */
    data object Hidden : RamVerdict

    /**
     * We do not start it: it needs more than the budget (an automatic
     * context), or more than the phone's total RAM (a chosen one).
     */
    data class Refused(val needBytes: Long, val budgetBytes: Long) : RamVerdict

    /** A context the user chose takes more than the budget: it starts, and Android may stop it. */
    data class OverBudget(val needBytes: Long, val budgetBytes: Long) : RamVerdict

    /** It fits, on a small phone: start it after a warning. */
    data class Tight(val needBytes: Long, val budgetBytes: Long) : RamVerdict

    data class Fits(val needBytes: Long, val budgetBytes: Long) : RamVerdict
}
