package com.phonecando.pce.json

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Near
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.core.Pce
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class PceJsonTest {
    @Test
    fun snapshotRoundTrip() = runBlocking {
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
        try {
            val snapshot = pce.observe().getOrThrow()
            val decoded = PceJson.decodeSnapshot(PceJson.encodeSnapshot(snapshot)).getOrThrow()

            assertEquals(snapshot, decoded)
        } finally {
            pce.close()
        }
    }

    @Test
    fun selectorRoundTrip() {
        val selector = Selector(
            viewId = "com.example:id/search",
            text = "Search",
            textContains = "sea",
            contentDescription = "Search field",
            className = "android.widget.EditText",
            packageName = "com.example",
            index = 0,
            parent = Selector(text = "root", requiredFlags = setOf(NodeFlag.CLICKABLE)),
            near = Near(Point(10, 20), radius = 100),
            requiredFlags = setOf(NodeFlag.VISIBLE, NodeFlag.ENABLED),
            forbiddenFlags = setOf(NodeFlag.PASSWORD),
        )

        val decoded = PceJson.decodeSelector(PceJson.encodeSelector(selector)).getOrThrow()

        assertEquals(selector, decoded)
    }

    @Test
    fun actionRoundTrip() {
        val actions = listOf(
            Action.Tap(Target.Node(NodeId(1))),
            Action.Tap(Target.BySelector(Selector(text = "Add"))),
            Action.Tap(Target.Coordinates(Point(10, 20))),
            Action.LongPress(Target.Node(NodeId(1)), durationMs = 700),
            Action.TypeText(
                text = "hello",
                target = Target.BySelector(Selector(viewId = "com.example:id/search")),
                clear = true,
            ),
            Action.TypeText(text = "focused"),
            Action.Key(KeyCode.BACK),
            Action.Scroll(
                direction = ScrollDirection.DOWN,
                target = Target.Node(NodeId(1)),
                amount = 0.75f,
            ),
            Action.Scroll(direction = ScrollDirection.UP),
            Action.Swipe(Point(1, 2), Point(3, 4), durationMs = 250),
            Action.Wait(Selector(text = "Later"), timeoutMs = 1_234),
            Action.Assert(Selector(text = "Present")),
            Action.Screenshot(full = true),
            Action.Launch("com.example", ".Main"),
        )

        actions.forEach { action ->
            val decoded = PceJson.decodeAction(PceJson.encodeAction(action)).getOrThrow()
            assertEquals(action, decoded)
        }
    }

    @Test
    fun errorRoundTrip() {
        val error = PceError(
            code = ErrorCode.AMBIGUOUS,
            message = "Selector matched 2 nodes",
            recovery = Recovery("resolve", "Add index"),
            candidates = listOf(NodeId(1), NodeId(2)),
        )

        val decoded = PceJson.decodeError(PceJson.encodeError(error)).getOrThrow()

        assertEquals(error, decoded)
    }

    @Test
    fun strictActionRejectsUnknownField() {
        val result = PceJson.decodeActionStrict(
            """{"type":"tap","target":{"type":"coordinates","point":{"x":1,"y":2}},"bogus":true}"""
        )

        assertEquals(ErrorCode.INVALID_ACTION, (result as PceResult.Err).error.code)
    }

    @Test
    fun strictSelectorRejectsUnknownField() {
        val result = PceJson.decodeSelectorStrict("""{"text":"Add","bogus":true}""")

        assertEquals(ErrorCode.INVALID_SELECTOR, (result as PceResult.Err).error.code)
    }

    @Test
    fun malformedSnapshotReturnsTypedError() {
        val result = PceJson.decodeSnapshot("{}")
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
    }

    @Test
    fun invalidSnapshotIdReturnsTypedError() {
        val result = PceJson.decodeSnapshot(
            """
            {
              "id": 0,
              "capturedAtMs": 1,
              "backend": "fake",
              "device": {
                "sdk": 36,
                "displayWidth": 1080,
                "displayHeight": 2400,
                "rotation": 0,
                "screenOn": true,
                "keyguard": false,
                "imeVisible": false
              }
            }
            """.trimIndent()
        )
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
    }

    @Test
    fun malformedActionReturnsTypedError() {
        val result = PceJson.decodeAction("""{"type":"tap"}""")
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_ACTION, error.code)
    }

    @Test
    fun unknownActionTypeReturnsTypedError() {
        val result = PceJson.decodeAction("""{"type":"dance"}""")
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_ACTION, error.code)
    }

    @Test
    fun unknownSnapshotFieldsAreIgnored() = runBlocking {
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
        try {
            val snapshot: Snapshot = pce.observe().getOrThrow()
            val encoded = PceJson.encodeSnapshot(snapshot).dropLast(1) + ",\"futureField\":true}"
            val decoded = PceJson.decodeSnapshot(encoded).getOrThrow()

            assertEquals(snapshot, decoded)
        } finally {
            pce.close()
        }
    }
}
