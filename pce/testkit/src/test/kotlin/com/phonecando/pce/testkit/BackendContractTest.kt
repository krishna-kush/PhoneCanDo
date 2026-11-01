package com.phonecando.pce.testkit

import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Capability
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class BackendContractTest {
    @Test
    fun fakeBackendSatisfiesContract() = runBlocking {
        BackendContract.verify(FakeBackend())
    }

    @Test
    fun undeclaredCapabilityMustBeRejected() = runBlocking {
        val backend = FakeBackend(
            capabilities = Capability.entries.toSet() - Capability.TAP,
        )

        val failure = assertFailsWith<AssertionError> {
            BackendContract.verify(backend)
        }

        assertTrue(failure.message.orEmpty().contains("without declaring"))
    }

    @Test
    fun duplicateBackendNodeIdsFail() = runBlocking {
        val nodes = Fixtures.defaultNodes()
        val backend = FakeBackend(
            Fixtures.rawSnapshot(
                nodes = listOf(
                    nodes[0],
                    nodes[1].copy(backendId = BackendNodeId("root")),
                ),
                focused = null,
            )
        )

        val failure = assertFailsWith<AssertionError> {
            BackendContract.verify(backend)
        }

        assertTrue(failure.message.orEmpty().contains("duplicate"))
    }
}
