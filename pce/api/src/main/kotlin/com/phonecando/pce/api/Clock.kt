package com.phonecando.pce.api

/** Injected time source; the PCE never calls a wall clock directly. */
fun interface Clock {
    fun nowMs(): Long

    companion object {
        val System: Clock = Clock { java.lang.System.currentTimeMillis() }
    }
}
