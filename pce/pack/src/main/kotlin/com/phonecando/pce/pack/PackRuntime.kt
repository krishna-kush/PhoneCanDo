package com.phonecando.pce.pack

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.ActionResult
import com.phonecando.pce.api.PhoneControlEngine
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.map
import com.phonecando.pce.json.PceJson
import java.nio.charset.StandardCharsets
import java.security.PublicKey
import java.security.Signature
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Loads, validates and runs signed declarative packs.
 *
 * A signature is Ed25519 over the exact UTF-8 pack JSON bytes; the detached
 * signature is base64. Loading rejects bad signatures before parsing, then
 * validates the schema, contract, minimum PCE version and every selector,
 * flow and action. Unknown JSON fields and snapshot-node targets are rejected.
 *
 * The host owns pack storage, refresh and rollback. This runtime only verifies
 * and executes a pack against a [PhoneControlEngine].
 */
@OptIn(ExperimentalEncodingApi::class)
@ExperimentalPceApi
class PackRuntime(
    private val pce: PhoneControlEngine,
    private val publicKey: PublicKey,
    private val pceVersion: String,
    private val contract: String = "1.0",
) {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = false
    }
    private val pceSemver = parseVersion(pceVersion)

    /**
     * Verify [signatureBase64] over [packJson], parse it strictly, and return a
     * validated [Pack]. Expected failures are typed `PceResult.Err`.
     */
    fun load(packJson: String, signatureBase64: String): PceResult<Pack> {
        val signature = try {
            Base64.Default.decode(signatureBase64)
        } catch (_: IllegalArgumentException) {
            return signatureInvalid("Pack signature is not valid base64")
        }
        if (!signatureValid(packJson, signature)) {
            return signatureInvalid("Pack signature does not match the trusted key")
        }

        val dto = try {
            json.decodeFromString(PackDto.serializer(), packJson)
        } catch (failure: Exception) {
            return invalid("Invalid pack JSON: ${failure.message}")
        }
        return validate(dto)
    }

    /**
     * Run [flowId] from [pack]. The initial screen must already show the pack's
     * app unless the first step launches it. Each step is observed before it is
     * executed; `expect` and `verify` use [Action.Assert].
     */
    suspend fun run(
        pack: Pack,
        flowId: String,
        appVersionCode: Int,
        params: Map<String, String> = emptyMap(),
    ): PceResult<FlowResult> {
        val flow = pack.flows.firstOrNull { it.id == flowId }
            ?: return PceResult.Err(
                PceError(
                    code = ErrorCode.NOT_FOUND,
                    message = "Flow $flowId is not in pack ${pack.id}",
                    recovery = Recovery("flow", "List the flows in the active pack"),
                )
            )
        if (appVersionCode !in pack.app.minVersionCode..pack.app.maxVersionCode) {
            return incompatible(
                "App versionCode $appVersionCode is outside " +
                    "${pack.app.minVersionCode}..${pack.app.maxVersionCode}"
            )
        }
        for ((name, param) in flow.params) {
            if (param.required && params[name] == null) {
                return invalid("Missing required flow parameter: $name")
            }
        }
        // Substitute and validate before observing so a missing optional
        // parameter or an invalid substituted value cannot leave earlier steps
        // half-applied.
        val preparedSteps = mutableListOf<PackStep>()
        for ((index, step) in flow.steps.withIndex()) {
            val action = when (val result = step.action.withParams(params)) {
                is PceResult.Ok -> result.value
                is PceResult.Err ->
                    return invalid("Flow ${flow.id} step $index: ${result.error.message}")
            }
            validateAction(action)?.let {
                return invalid("Flow ${flow.id} step $index: $it")
            }
            val expect = step.expect?.let { selector ->
                val expected = when (val result = selector.withParams(params)) {
                    is PceResult.Ok -> result.value
                    is PceResult.Err ->
                        return invalid("Flow ${flow.id} step $index expect: ${result.error.message}")
                }
                if (!expected.isValid) {
                    return invalid("Flow ${flow.id} step $index expect is not valid")
                }
                expected
            }
            preparedSteps += PackStep(action, expect)
        }
        val preparedVerify = mutableListOf<Selector>()
        for ((index, selector) in flow.verify.withIndex()) {
            val expected = when (val result = selector.withParams(params)) {
                is PceResult.Ok -> result.value
                is PceResult.Err ->
                    return invalid("Flow ${flow.id} verify $index: ${result.error.message}")
            }
            if (!expected.isValid) {
                return invalid("Flow ${flow.id} verify $index is not valid")
            }
            preparedVerify += expected
        }

        val initial = when (val result = pce.observe()) {
            is PceResult.Ok -> result.value
            is PceResult.Err -> return result
        }
        val first = preparedSteps.firstOrNull()?.action
        val launchesTarget = first is Action.Launch && first.packageName == pack.app.packageName
        val currentPackage = initial.packageName
        if (!launchesTarget && currentPackage != pack.app.packageName) {
            return incompatible(
                "Pack ${pack.id} targets ${pack.app.packageName}, " +
                    "current package is ${currentPackage ?: "unknown"}"
            )
        }

        val results = mutableListOf<ActionResult>()
        var snapshot: Snapshot = initial
        for ((index, step) in preparedSteps.withIndex()) {
            val acted = when (val result = pce.act(snapshot.id, step.action)) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return stepFailure(result.error, flow.id, index)
            }
            results += acted

            snapshot = when (val result = pce.observe()) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return stepFailure(result.error, flow.id, index)
            }
            step.expect?.let { expected ->
                val asserted = when (val result = pce.act(snapshot.id, Action.Assert(expected))) {
                    is PceResult.Ok -> result.value
                    is PceResult.Err -> return stepFailure(result.error, flow.id, index)
                }
                results += asserted
            }
        }

        for ((index, expected) in preparedVerify.withIndex()) {
            val asserted = when (val result = pce.act(snapshot.id, Action.Assert(expected))) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return stepFailure(result.error, flow.id, flow.steps.size + index)
            }
            results += asserted
        }
        return PceResult.Ok(FlowResult(flow.id, flow.steps.size, results))
    }

    private fun validate(dto: PackDto): PceResult<Pack> {
        if (dto.schema != SCHEMA) {
            return incompatible("Unsupported pack schema: ${dto.schema}")
        }
        if (dto.id.isBlank() || dto.version <= 0) {
            return invalid("Pack id must not be blank and version must be positive")
        }
        if (dto.app.pkg.isBlank() ||
            dto.app.minVersionCode < 0 ||
            dto.app.maxVersionCode < dto.app.minVersionCode
        ) {
            return invalid("Pack app package and versionCode range are invalid")
        }
        if (dto.contract != contract) {
            return incompatible("Pack contract ${dto.contract} does not match $contract")
        }
        val minPce = parseVersion(dto.minPce)
            ?: return invalid("Invalid minPce: ${dto.minPce}")
        val currentPce = pceSemver
            ?: return PceResult.Err(
                PceError(
                    code = ErrorCode.INTERNAL,
                    message = "Invalid pce version: $pceVersion",
                )
            )
        if (compareVersions(minPce, currentPce) > 0) {
            return incompatible("Pack requires PCE ${dto.minPce} or newer")
        }
        if (dto.selectors.keys.any { it.isBlank() }) {
            return invalid("Selector names must not be blank")
        }

        val selectors = linkedMapOf<String, Selector>()
        for ((name, element) in dto.selectors) {
            val selector = when (val result = PceJson.decodeSelectorStrict(element.toString())) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return invalid("Selector $name: ${result.error.message}")
            }
            if (!selector.isValid) return invalid("Selector $name is not valid")
            selectors[name] = selector
        }

        val flows = mutableListOf<PackFlow>()
        val flowIds = mutableSetOf<String>()
        for (flowDto in dto.flows) {
            if (flowDto.id.isBlank() || !flowIds.add(flowDto.id)) {
                return invalid("Flow ids must be unique and non-blank")
            }
            val params = linkedMapOf<String, PackParam>()
            for ((name, param) in flowDto.params) {
                if (name.isBlank()) return invalid("Flow ${flowDto.id} has a blank parameter")
                if (param.type != "string") {
                    return invalid(
                        "Flow ${flowDto.id} parameter $name has unsupported type ${param.type}"
                    )
                }
                params[name] = PackParam(param.type, param.required)
            }

            val steps = mutableListOf<PackStep>()
            val usedParams = mutableSetOf<String>()
            for ((index, stepDto) in flowDto.steps.withIndex()) {
                val actionJson = resolveSelectorRefs(stepDto.action, dto.selectors)
                usedParams += placeholders(actionJson)
                val action = when (val result = PceJson.decodeActionStrict(actionJson.toString())) {
                    is PceResult.Ok -> result.value
                    is PceResult.Err ->
                        return invalid("Flow ${flowDto.id} step $index: ${result.error.message}")
                }
                validateAction(action)?.let {
                    return invalid("Flow ${flowDto.id} step $index: $it")
                }
                val expect = stepDto.expect?.let { element ->
                    usedParams += placeholders(resolveSelector(element, dto.selectors))
                    when (val result = decodeSelector(element, dto.selectors, "Flow ${flowDto.id} step $index expect")) {
                        is PceResult.Ok -> result.value
                        is PceResult.Err -> return result
                    }
                }
                steps += PackStep(action, expect)
            }

            val verify = mutableListOf<Selector>()
            for ((index, element) in flowDto.verify.withIndex()) {
                usedParams += placeholders(resolveSelector(element, dto.selectors))
                when (val result = decodeSelector(element, dto.selectors, "Flow ${flowDto.id} verify $index")) {
                    is PceResult.Ok -> verify += result.value
                    is PceResult.Err -> return result
                }
            }
            val undeclared = usedParams - flowDto.params.keys
            if (undeclared.isNotEmpty()) {
                return invalid(
                    "Flow ${flowDto.id} uses undeclared parameters: " +
                        undeclared.sorted().joinToString()
                )
            }
            flows += PackFlow(flowDto.id, params, steps, verify)
        }

        return PceResult.Ok(
            Pack(
                schema = dto.schema,
                id = dto.id,
                version = dto.version,
                app = PackApp(dto.app.pkg, dto.app.minVersionCode, dto.app.maxVersionCode),
                contract = dto.contract,
                minPce = dto.minPce,
                selectors = selectors,
                flows = flows,
                notes = dto.notes,
            )
        )
    }

    private fun decodeSelector(
        element: JsonElement,
        named: Map<String, JsonElement>,
        label: String,
    ): PceResult<Selector> {
        val resolved = resolveSelector(element, named)
        return when (val result = PceJson.decodeSelectorStrict(resolved.toString())) {
            is PceResult.Ok -> if (result.value.isValid) {
                result
            } else {
                invalid("$label is not valid")
            }
            is PceResult.Err -> invalid("$label: ${result.error.message}")
        }
    }

    private fun validateAction(action: Action): String? = when (action) {
        is Action.Tap -> validateTarget(action.target)
        is Action.LongPress -> when {
            action.durationMs <= 0 -> "long press duration must be positive"
            else -> validateTarget(action.target)
        }
        is Action.TypeText -> action.target?.let(::validateTarget)
        is Action.Scroll -> when {
            action.amount <= 0f || action.amount > 1f -> "scroll amount must be in (0, 1]"
            else -> action.target?.let(::validateTarget)
        }
        is Action.Key, is Action.Screenshot -> null
        is Action.Swipe -> if (action.durationMs <= 0) {
            "swipe duration must be positive"
        } else {
            null
        }
        is Action.Wait -> when {
            action.timeoutMs <= 0 -> "wait timeout must be positive"
            !action.selector.isValid -> "wait selector is not valid"
            else -> null
        }
        is Action.Assert -> if (action.selector.isValid) null else "assert selector is not valid"
        is Action.Launch -> if (action.packageName.isBlank()) "launch package must not be blank" else null
    }

    private fun validateTarget(target: Target): String? = when (target) {
        is Target.Node -> "pack actions cannot reference snapshot node ids"
        is Target.BySelector -> if (target.selector.isValid) null else "target selector is not valid"
        is Target.Coordinates -> null
    }

    private fun resolveSelector(
        element: JsonElement,
        named: Map<String, JsonElement>,
    ): JsonElement =
        if (element is JsonPrimitive && element.isString) {
            named[element.content] ?: element
        } else {
            resolveSelectorRefs(element, named)
        }

    private fun placeholders(element: JsonElement): Set<String> = when (element) {
        is JsonObject -> element.values.flatMapTo(mutableSetOf()) { placeholders(it) }
        is JsonArray -> element.flatMapTo(mutableSetOf()) { placeholders(it) }
        is JsonPrimitive -> if (element.isString) {
            PLACEHOLDER.findAll(element.content)
                .mapTo(mutableSetOf()) { it.groupValues[1] }
        } else {
            emptySet()
        }
    }

    private fun resolveSelectorRefs(
        element: JsonElement,
        named: Map<String, JsonElement>,
    ): JsonElement = when (element) {
        is JsonObject -> JsonObject(
            element.mapValues { (key, value) ->
                if (key == "selector" && value is JsonPrimitive && value.isString) {
                    named[value.content] ?: value
                } else {
                    resolveSelectorRefs(value, named)
                }
            }
        )
        is JsonArray -> JsonArray(element.map { resolveSelectorRefs(it, named) })
        else -> element
    }

    private fun Action.withParams(params: Map<String, String>): PceResult<Action> = when (this) {
        is Action.Tap -> target.withParams(params).map { Action.Tap(it) }
        is Action.LongPress -> target.withParams(params).map {
            Action.LongPress(it, durationMs)
        }
        is Action.TypeText -> {
            val text = when (val result = text.withParams(params)) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return result
            }
            val target = when (val result = target?.withParams(params)) {
                null -> null
                is PceResult.Ok -> result.value
                is PceResult.Err -> return result
            }
            PceResult.Ok(Action.TypeText(text = text, target = target, clear = clear))
        }
        is Action.Key, is Action.Swipe, is Action.Screenshot -> PceResult.Ok(this)
        is Action.Scroll -> {
            val target = when (val result = target?.withParams(params)) {
                null -> null
                is PceResult.Ok -> result.value
                is PceResult.Err -> return result
            }
            PceResult.Ok(Action.Scroll(direction = direction, target = target, amount = amount))
        }
        is Action.Wait -> selector.withParams(params).map { Action.Wait(it, timeoutMs) }
        is Action.Assert -> selector.withParams(params).map { Action.Assert(it) }
        is Action.Launch -> {
            val packageName = when (val result = packageName.withParams(params)) {
                is PceResult.Ok -> result.value
                is PceResult.Err -> return result
            }
            val activityName = when (val result = activityName?.withParams(params)) {
                null -> null
                is PceResult.Ok -> result.value
                is PceResult.Err -> return result
            }
            PceResult.Ok(Action.Launch(packageName, activityName))
        }
    }

    private fun Target.withParams(params: Map<String, String>): PceResult<Target> = when (this) {
        is Target.Node -> invalid("Pack actions cannot reference snapshot node ids")
        is Target.BySelector -> selector.withParams(params).map { Target.BySelector(it) }
        is Target.Coordinates -> PceResult.Ok(this)
    }

    private fun Selector.withParams(params: Map<String, String>): PceResult<Selector> {
        val parent = when (val result = parent?.withParams(params)) {
            null -> null
            is PceResult.Ok -> result.value
            is PceResult.Err -> return result
        }
        val strings = listOf(viewId, text, textContains, contentDescription, className, packageName)
            .map { it.withParamsOrNull(params) }
            .all()
        val values = when (strings) {
            is PceResult.Ok -> strings.value
            is PceResult.Err -> return strings
        }
        return PceResult.Ok(
            copy(
                viewId = values[0],
                text = values[1],
                textContains = values[2],
                contentDescription = values[3],
                className = values[4],
                packageName = values[5],
                parent = parent,
            )
        )
    }

    private fun String.withParams(params: Map<String, String>): PceResult<String> {
        var missing: String? = null
        val replaced = PLACEHOLDER.replace(this) { match ->
            val key = match.groupValues[1]
            params[key] ?: run {
                missing = key
                match.value
            }
        }
        return if (missing == null) {
            PceResult.Ok(replaced)
        } else {
            invalid("Missing flow parameter: $missing")
        }
    }

    private fun String?.withParamsOrNull(params: Map<String, String>): PceResult<String?> =
        this?.let { value -> value.withParams(params).map { it } } ?: PceResult.Ok(null)

    private fun <T> List<PceResult<T>>.all(): PceResult<List<T>> {
        val values = ArrayList<T>(size)
        for (result in this) {
            when (result) {
                is PceResult.Ok -> values += result.value
                is PceResult.Err -> return result
            }
        }
        return PceResult.Ok(values)
    }

    private fun signatureValid(packJson: String, signature: ByteArray): Boolean =
        try {
            val verifier = Signature.getInstance("Ed25519")
            verifier.initVerify(publicKey)
            verifier.update(packJson.toByteArray(StandardCharsets.UTF_8))
            verifier.verify(signature)
        } catch (_: Exception) {
            false
        }

    private fun stepFailure(error: PceError, flowId: String, step: Int): PceResult.Err =
        PceResult.Err(
            error.copy(message = "Flow $flowId step $step: ${error.message}")
        )

    private fun invalid(message: String): PceResult.Err =
        PceResult.Err(
            PceError(
                code = ErrorCode.INVALID_PACK,
                message = message,
                recovery = Recovery("pack", "Fix the pack JSON or flow parameters"),
            )
        )

    private fun signatureInvalid(message: String): PceResult.Err =
        PceResult.Err(
            PceError(
                code = ErrorCode.PACK_SIGNATURE_INVALID,
                message = message,
                recovery = Recovery("pack", "Sign the exact pack bytes with the trusted Ed25519 key"),
            )
        )

    private fun incompatible(message: String): PceResult.Err =
        PceResult.Err(
            PceError(
                code = ErrorCode.PACK_INCOMPATIBLE,
                message = message,
                recovery = Recovery("pack", "Update the pack or pce"),
            )
        )

    private fun parseVersion(value: String): IntArray? {
        val core = value.substringBefore('-').substringBefore('+')
        val parts = core.split('.')
        if (parts.size != 3) return null
        val numbers = parts.map { it.toIntOrNull() ?: return null }
        if (numbers.any { it < 0 }) return null
        return numbers.toIntArray()
    }

    private fun compareVersions(left: IntArray, right: IntArray): Int {
        for (index in 0..2) {
            if (left[index] != right[index]) return left[index].compareTo(right[index])
        }
        return 0
    }

    private companion object {
        const val SCHEMA = "phonecando.pack/v1"
        val PLACEHOLDER = Regex("""\{\{([^{}]+)\}\}""")
    }
}

@Serializable
private data class PackDto(
    val schema: String,
    val id: String,
    val version: Int,
    val app: AppDto,
    val contract: String,
    val minPce: String,
    val selectors: Map<String, JsonElement> = emptyMap(),
    val flows: List<FlowDto> = emptyList(),
    val notes: List<String> = emptyList(),
)

@Serializable
private data class AppDto(
    val pkg: String,
    val minVersionCode: Int,
    val maxVersionCode: Int,
)

@Serializable
private data class FlowDto(
    val id: String,
    val params: Map<String, ParamDto> = emptyMap(),
    val steps: List<StepDto> = emptyList(),
    val verify: List<JsonElement> = emptyList(),
)

@Serializable
private data class ParamDto(
    val type: String = "string",
    val required: Boolean = false,
)

@Serializable
private data class StepDto(
    val action: JsonElement,
    val expect: JsonElement? = null,
)
