@file:OptIn(com.phonecando.pce.api.ExperimentalPceApi::class)

package com.phonecando.pce.core

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.BackendContract
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class RoutingBackendTest {
    @Test
    fun emptyBackendsAreRejected() {
        assertFailsWith<IllegalArgumentException> { RoutingBackend(emptyList()) }
    }

    @Test
    fun observeUsesObservingBackendAndOwnsSnapshot() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.TAP)
        val ime = fake(Capability.SET_TEXT)
        val router = RoutingBackend(listOf(a11y, ime))

        val snapshot = router.observe().getOrThrow()

        assertEquals("router", snapshot.backend)
        assertEquals(1, a11y.observations)
        assertEquals(0, ime.observations)
        assertEquals(setOf(Capability.OBSERVE, Capability.TAP, Capability.SET_TEXT), router.capabilities)
    }

    @Test
    fun observePassesScreenshotOptionToBackend() = runBlocking {
        val a11y = fake(Capability.OBSERVE)
        val router = RoutingBackend(listOf(a11y))

        router.observe(ObserveOptions(screenshot = true)).getOrThrow()

        assertEquals(true, a11y.lastObserveOptions?.screenshot)
    }

    @Test
    fun observeFallsBackWhenFirstObserverIsUnavailable() = runBlocking {
        val failing = FailingObserveBackend(ErrorCode.BACKEND_UNAVAILABLE)
        val a11y = fake(Capability.OBSERVE)
        val router = RoutingBackend(listOf(failing, a11y))

        val snapshot = router.observe().getOrThrow()

        assertEquals("router", snapshot.backend)
        assertEquals(1, a11y.observations)
    }

    @Test
    fun tapUsesGestureBackend() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.TAP)
        val ime = fake(Capability.SET_TEXT)
        val router = RoutingBackend(listOf(a11y, ime))

        router.execute(BackendAction.Tap(point = Point(10, 20))).getOrThrow()

        assertEquals(listOf<BackendAction>(BackendAction.Tap(point = Point(10, 20))), a11y.executed)
        assertTrue(ime.executed.isEmpty())
    }

    @Test
    fun tapFallsBackWhenPrimaryIsUnavailable() = runBlocking {
        val a11y = fake(Capability.TAP, onExecute = { unavailable() })
        val shizuku = fake(Capability.TAP)
        val router = RoutingBackend(listOf(a11y, shizuku))

        router.execute(BackendAction.Tap(point = Point(1, 2))).getOrThrow()

        assertEquals(1, a11y.executed.size)
        assertEquals(1, shizuku.executed.size)
    }

    @Test
    fun internalErrorDoesNotFallback() = runBlocking {
        val a11y = fake(Capability.TAP, onExecute = { internal() })
        val shizuku = fake(Capability.TAP)
        val router = RoutingBackend(listOf(a11y, shizuku))

        val result = router.execute(BackendAction.Tap(point = Point(1, 2)))

        assertEquals(ErrorCode.INTERNAL, (result as PceResult.Err).error.code)
        assertTrue(shizuku.executed.isEmpty())
    }

    @Test
    fun setTextUsesObservingBackendFirst() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.SET_TEXT)
        val ime = fake(Capability.SET_TEXT)
        val router = RoutingBackend(listOf(a11y, ime))

        router.execute(BackendAction.SetText(BackendNodeId("search"), "hello", clear = false))
            .getOrThrow()

        assertEquals(1, a11y.executed.size)
        assertTrue(ime.executed.isEmpty())
    }

    @Test
    fun setTextFallsBackToIme() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.SET_TEXT, onExecute = { unsupported() })
        val ime = fake(Capability.SET_TEXT)
        val router = RoutingBackend(listOf(a11y, ime))

        router.execute(BackendAction.SetText(BackendNodeId("search"), "hello", clear = true))
            .getOrThrow()

        assertEquals(1, a11y.executed.size)
        assertEquals(1, ime.executed.size)
    }

    @Test
    fun globalKeyUsesObservingBackend() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.KEY)
        val ime = fake(Capability.KEY)
        val router = RoutingBackend(listOf(a11y, ime))

        router.execute(BackendAction.Key(KeyCode.BACK)).getOrThrow()

        assertEquals(1, a11y.executed.size)
        assertTrue(ime.executed.isEmpty())
    }

    @Test
    fun enterUsesTextOnlyBackendFirst() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.KEY)
        val ime = fake(Capability.KEY)
        val router = RoutingBackend(listOf(a11y, ime))

        router.execute(BackendAction.Key(KeyCode.ENTER)).getOrThrow()

        assertEquals(1, ime.executed.size)
        assertTrue(a11y.executed.isEmpty())
    }

    @Test
    fun unsupportedKeyFallsThroughToShizuku() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.KEY, onExecute = { unsupported() })
        val ime = fake(Capability.KEY, onExecute = { unsupported() })
        val shizuku = fake(Capability.KEY)
        val router = RoutingBackend(listOf(a11y, ime, shizuku))

        router.execute(BackendAction.Key(KeyCode.TAB)).getOrThrow()

        assertEquals(1, a11y.executed.size)
        assertEquals(1, ime.executed.size)
        assertEquals(1, shizuku.executed.size)
    }

    @Test
    fun screenshotWithoutCapabilityIsUnsupported() = runBlocking {
        val a11y = fake(Capability.OBSERVE)
        val router = RoutingBackend(listOf(a11y))

        val result = router.execute(BackendAction.Screenshot())

        assertEquals(ErrorCode.UNSUPPORTED_ACTION, (result as PceResult.Err).error.code)
        assertTrue(a11y.executed.isEmpty())
    }

    @Test
    fun closeClosesAllBackends() = runBlocking {
        val a11y = fake(Capability.OBSERVE)
        val ime = fake(Capability.SET_TEXT)

        RoutingBackend(listOf(a11y, ime)).close()

        assertTrue(a11y.closed)
        assertTrue(ime.closed)
    }

    @Test
    fun routerPassesBackendContract() = runBlocking {
        val a11y = fake(Capability.OBSERVE, Capability.TAP)
        val ime = fake(Capability.SET_TEXT, Capability.KEY)

        BackendContract.verify(RoutingBackend(listOf(a11y, ime)))
    }

    private fun fake(
        vararg capabilities: Capability,
        onExecute: (BackendAction) -> PceResult<Unit> = { PceResult.Ok(Unit) },
    ): FakeBackend = FakeBackend(
        Fixtures.rawSnapshot(),
        capabilities = capabilities.toSet(),
        onExecute = onExecute,
    )

    private fun unsupported(): PceResult<Unit> =
        PceResult.Err(PceError(ErrorCode.UNSUPPORTED_ACTION, "unsupported"))

    private fun unavailable(): PceResult<Unit> =
        PceResult.Err(PceError(ErrorCode.BACKEND_UNAVAILABLE, "unavailable"))

    private fun internal(): PceResult<Unit> =
        PceResult.Err(PceError(ErrorCode.INTERNAL, "internal"))

    private class FailingObserveBackend(
        private val code: ErrorCode,
    ) : Backend {
        override val id: String = "failing-observe"
        override val capabilities: Set<Capability> = setOf(Capability.OBSERVE)

        override suspend fun observe(options: ObserveOptions): PceResult<com.phonecando.pce.api.RawSnapshot> =
            PceResult.Err(PceError(code, "observe failed"))

        override suspend fun execute(action: BackendAction): PceResult<Unit> =
            PceResult.Err(PceError(ErrorCode.UNSUPPORTED_ACTION, "no execute"))
    }
}
