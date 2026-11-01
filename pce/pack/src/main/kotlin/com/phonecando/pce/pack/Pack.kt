package com.phonecando.pce.pack

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.ActionResult
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Selector

/** A validated, declarative app pack. It contains no executable code. */
@ExperimentalPceApi
data class Pack(
    val schema: String,
    val id: String,
    val version: Int,
    val app: PackApp,
    val contract: String,
    val minPce: String,
    val selectors: Map<String, Selector>,
    val flows: List<PackFlow>,
    val notes: List<String> = emptyList(),
)

/** App package and versionCode range a pack is written for. */
@ExperimentalPceApi
data class PackApp(
    val packageName: String,
    val minVersionCode: Int,
    val maxVersionCode: Int,
)

/** A named, parameterized flow from a pack. */
@ExperimentalPceApi
data class PackFlow(
    val id: String,
    val params: Map<String, PackParam> = emptyMap(),
    val steps: List<PackStep> = emptyList(),
    val verify: List<Selector> = emptyList(),
)

/** One flow step and its optional postcondition. */
@ExperimentalPceApi
data class PackStep(
    val action: Action,
    val expect: Selector? = null,
)

/** A flow parameter. Only `string` is supported in v1. */
@ExperimentalPceApi
data class PackParam(
    val type: String = "string",
    val required: Boolean = false,
)

/** Result of running one flow. */
@ExperimentalPceApi
data class FlowResult(
    val flowId: String,
    val steps: Int,
    val results: List<ActionResult>,
)
