package com.phonecando.lme.host

import com.phonecando.lme.api.serve.WireApi

/**
 * A runtime that serves model weights over HTTP on loopback: the seam
 * between our models and the program that runs them. llama.cpp
 * ([com.phonecando.lme.host.llamacpp.LlamaCppRuntime]) is the first; a
 * runtime turns a model and the phone into a launch plan and never starts a
 * process itself (the host's supervisor does).
 */
interface ModelRuntime {
    /** Stable id of the runtime (`llamacpp`). */
    val id: String

    /** The wire APIs every server of this runtime answers. */
    val apis: Set<WireApi>

    /**
     * How to start a server for [request], or why not.
     *
     * @throws com.phonecando.lme.api.LmeException.UnsupportedDevice when the
     *   phone cannot run this runtime or is below our RAM floor
     * @throws com.phonecando.lme.api.LmeException.NotEnoughMemory when the
     *   model would take more than our share of RAM
     */
    fun plan(request: LaunchRequest): LaunchPlan
}
