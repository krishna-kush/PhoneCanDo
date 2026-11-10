package com.phonecando.lme.catalog.parameters

/**
 * How many parameters a model has, as [ModelSizes] gives it: [count] of
 * them. [effective] marks Gemma's E sizes ("E2B"): the size the model runs
 * at, its per-layer embeddings left out (they are looked up, not computed).
 */
data class ParameterCount(val count: Long, val effective: Boolean = false) {
    init {
        require(count > 0) { "a parameter count is positive" }
    }
}
