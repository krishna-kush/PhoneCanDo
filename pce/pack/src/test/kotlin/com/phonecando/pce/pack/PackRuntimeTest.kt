@file:OptIn(ExperimentalPceApi::class)

package com.phonecando.pce.pack

import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.core.Pce
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import java.nio.charset.StandardCharsets
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.Signature
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@OptIn(ExperimentalEncodingApi::class)
class PackRuntimeTest {
    @Test
    fun loadsAndRunsFlowAgainstFakeBackend() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(packJson())

        val result = runtime.run(
            pack = pack,
            flowId = "search",
            appVersionCode = 150,
            params = mapOf("query" to "milk"),
        ).getOrThrow()

        assertEquals("search", result.flowId)
        assertEquals(3, result.steps)
        assertEquals(5, result.results.size)
        assertEquals(3, backend.executed.size)
        assertEquals(
            BackendNodeId("search"),
            (backend.executed[0] as BackendAction.Tap).backendNodeId,
        )
        assertEquals("milk", (backend.executed[1] as BackendAction.SetText).text)
        assertEquals(KeyCode.ENTER, (backend.executed[2] as BackendAction.Key).key)
    }

    @Test
    fun waitAndAssertNamedSelectorsResolve() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(
            packJson(
                steps = """
                    [
                      {"action":{"type":"wait","selector":"search","timeoutMs":1000}},
                      {"action":{"type":"assert","selector":"search"}}
                    ]
                """.trimIndent(),
                verify = "[]",
                params = "{}",
            )
        )

        val result = runtime.run(pack, "search", appVersionCode = 150).getOrThrow()

        assertEquals(2, result.steps)
        assertEquals(2, result.results.size)
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun invalidPackVariantsAreRejected() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val base = packJson()
        val cases = listOf(
            Triple("malformed", "{", ErrorCode.INVALID_PACK),
            Triple(
                "schema",
                base.replace("\"schema\": \"phonecando.pack/v1\"", "\"schema\": \"phonecando.pack/v2\""),
                ErrorCode.PACK_INCOMPATIBLE,
            ),
            Triple(
                "blank id",
                base.replace("\"id\": \"com.example.pack\"", "\"id\": \"\""),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "zero version",
                base.replace("\"version\": 1", "\"version\": 0"),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "app range",
                packJson(minVersionCode = 10, maxVersionCode = 5),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "min pce",
                packJson(minPce = "bad"),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "blank selector",
                packJson(selectors = """{"":{}}"""),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "blank flow id",
                base.replace("\"id\": \"search\"", "\"id\": \"\""),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "duplicate flow id",
                base.replace(
                    "\"flows\": [",
                    "\"flows\": [{\"id\":\"search\",\"steps\":[],\"verify\":[]},",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "blank param",
                packJson(params = """{"":{"type":"string"}}"""),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "unsupported param type",
                packJson(params = """{"query":{"type":"number"}}"""),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "wait timeout",
                packJson(
                    steps = """[{"action":{"type":"wait","selector":"search","timeoutMs":0}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "assert selector",
                packJson(
                    steps = """[{"action":{"type":"assert","selector":{}}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "long press duration",
                packJson(
                    steps = """[{"action":{"type":"long_press","target":{"type":"selector","selector":"search"},"durationMs":0}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "scroll amount",
                packJson(
                    steps = """[{"action":{"type":"scroll","direction":"DOWN","amount":0}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "invalid expect",
                packJson(
                    steps = """[{"action":{"type":"key","key":"ENTER"},"expect":{}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "invalid verify",
                packJson(steps = "[]", verify = "[{}]", params = "{}"),
                ErrorCode.INVALID_PACK,
            ),
            Triple(
                "unknown selector",
                packJson(
                    steps = """[{"action":{"type":"tap","target":{"type":"selector","selector":"missing"}}}]""",
                    verify = "[]",
                    params = "{}",
                ),
                ErrorCode.INVALID_PACK,
            ),
        )

        for ((name, json, code) in cases) {
            assertEquals(code, runtime.load(json, sign(json)).errorCode(), name)
        }
    }

    @Test
    fun invalidBase64SignatureReturnsTypedError() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))

        val result = runtime.load(packJson(), "not base64!")

        assertEquals(ErrorCode.PACK_SIGNATURE_INVALID, result.errorCode())
    }

    @Test
    fun badSignatureReturnsTypedError() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson()

        val result = runtime.load(json, sign(json, otherKeyPair.private))

        assertEquals(ErrorCode.PACK_SIGNATURE_INVALID, result.errorCode())
    }

    @Test
    fun incompatibleMinEngineReturnsTypedError() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(minPce = "99.0.0")

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
    }

    @Test
    fun incompatibleContractReturnsTypedError() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(contract = "2.0")

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
    }

    @Test
    fun invalidPackReturnsTypedError() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(selectors = """{"search":{}}""")

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun missingParamReturnsTypedErrorBeforeAnyAction() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(packJson())

        val result = runtime.run(pack, "search", appVersionCode = 150)

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun missingOptionalParamReturnsTypedErrorBeforeAnyAction() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(
            packJson(
                steps = """
                    [
                      {"action":{"type":"tap","target":{"type":"selector","selector":"search"}}},
                      {"action":{"type":"type_text","text":"{{query}}","target":{"type":"selector","selector":"search"}}}
                    ]
                """.trimIndent(),
                verify = "[]",
                params = """{"query":{"type":"string","required":false}}""",
            )
        )

        val result = runtime.run(pack, "search", appVersionCode = 150)

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun invalidSubstitutedActionReturnsTypedErrorBeforeAnyAction() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(
            packJson(
                steps = """[{"action":{"type":"launch","packageName":"{{pkg}}"}}]""",
                verify = "[]",
                params = """{"pkg":{"type":"string","required":true}}""",
            )
        )

        val result = runtime.run(
            pack = pack,
            flowId = "search",
            appVersionCode = 150,
            params = mapOf("pkg" to ""),
        )

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun unknownFlowReturnsNotFound() = runBlocking {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val pack = runtime.loadSigned(packJson())

        val result = runtime.run(pack, "missing", appVersionCode = 150)

        assertEquals(ErrorCode.NOT_FOUND, result.errorCode())
    }

    @Test
    fun appVersionOutsideRangeReturnsIncompatible() = runBlocking {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val pack = runtime.loadSigned(packJson())

        val result = runtime.run(pack, "search", appVersionCode = 1001)

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
    }

    @Test
    fun parameterizedFirstLaunchSkipsInitialPackageCheck() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot().copy(packageName = "com.other"))
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(
            packJson(
                steps = """[{"action":{"type":"launch","packageName":"{{pkg}}"}}]""",
                verify = "[]",
                params = """{"pkg":{"type":"string","required":true}}""",
                appPkg = "com.example",
            )
        )

        val result = runtime.run(
            pack = pack,
            flowId = "search",
            appVersionCode = 150,
            params = mapOf("pkg" to "com.example"),
        ).getOrThrow()

        assertEquals(1, result.steps)
        assertEquals(BackendAction.Launch("com.example"), backend.executed.single())
    }

    @Test
    fun unknownInitialPackageReturnsIncompatibleBeforeAnyAction() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot().copy(packageName = null))
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(packJson())

        val result = runtime.run(
            pack = pack,
            flowId = "search",
            appVersionCode = 150,
            params = mapOf("query" to "milk"),
        )

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun packageMismatchReturnsIncompatibleBeforeAnyAction() = runBlocking {
        val backend = FakeBackend(Fixtures.rawSnapshot())
        val runtime = runtime(backend)
        val pack = runtime.loadSigned(packJson(appPkg = "com.other"))

        val result = runtime.run(
            pack = pack,
            flowId = "search",
            appVersionCode = 150,
            params = mapOf("query" to "milk"),
        )

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun snapshotNodeTargetIsRejected() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(
            steps = """[{"action":{"type":"tap","target":{"type":"node","nodeId":0}}}]""",
            verify = "[]",
        )

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun undeclaredPlaceholderIsRejectedAtLoad() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(
            steps = """[{"action":{"type":"type_text","text":"{{query}}"}}]""",
            verify = "[]",
            params = "{}",
        )

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun invalidSwipeDurationIsRejected() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(
            steps = """
                [{"action":{"type":"swipe","from":{"x":1,"y":1},"to":{"x":2,"y":2},"durationMs":0}}]
            """.trimIndent(),
            verify = "[]",
            params = "{}",
        )

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun strictActionRejectsUnknownField() {
        val runtime = runtime(FakeBackend(Fixtures.rawSnapshot()))
        val json = packJson(
            steps = """[{"action":{"type":"key","key":"ENTER","bogus":true}}]""",
            verify = "[]",
        )

        val result = runtime.load(json, sign(json))

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    private fun runtime(backend: FakeBackend): PackRuntime =
        PackRuntime(
            pce = Pce.create(backend),
            publicKey = keyPair.public,
            pceVersion = "0.1.0",
        )

    private fun PackRuntime.loadSigned(json: String): Pack = load(json, sign(json)).getOrThrow()

    private fun PceResult<*>.errorCode(): ErrorCode =
        (this as PceResult.Err).error.code

    private fun sign(text: String, privateKey: PrivateKey = keyPair.private): String {
        val signer = Signature.getInstance("Ed25519")
        signer.initSign(privateKey)
        signer.update(text.toByteArray(StandardCharsets.UTF_8))
        return Base64.Default.encode(signer.sign())
    }

    private fun packJson(
        steps: String = DEFAULT_STEPS,
        verify: String = """["search"]""",
        selectors: String = DEFAULT_SELECTORS,
        params: String = DEFAULT_PARAMS,
        minPce: String = "0.1.0",
        contract: String = "1.0",
        appPkg: String = "com.example",
        minVersionCode: Int = 1,
        maxVersionCode: Int = 1000,
    ): String = """
        {
          "schema": "phonecando.pack/v1",
          "id": "com.example.pack",
          "version": 1,
          "app": {
            "pkg": "$appPkg",
            "minVersionCode": $minVersionCode,
            "maxVersionCode": $maxVersionCode
          },
          "contract": "$contract",
          "minPce": "$minPce",
          "selectors": $selectors,
          "flows": [
            {
              "id": "search",
              "params": $params,
              "steps": $steps,
              "verify": $verify
            }
          ],
          "notes": ["Search is an EditText; tap it before typing."]
        }
    """.trimIndent()

    private companion object {
        val keyPair: KeyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val otherKeyPair: KeyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()

        const val DEFAULT_SELECTORS = """{"search":{"viewId":"com.example:id/search"}}"""
        const val DEFAULT_PARAMS = """{"query":{"type":"string","required":true}}"""
        val DEFAULT_STEPS = """
            [
              {"action":{"type":"tap","target":{"type":"selector","selector":"search"}}},
              {"action":{"type":"type_text","text":"{{query}}","target":{"type":"selector","selector":"search"}}},
              {"action":{"type":"key","key":"ENTER"},"expect":"search"}
            ]
        """.trimIndent()
    }
}
