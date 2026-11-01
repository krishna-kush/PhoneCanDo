package com.phonecando.pce.sample

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.core.Pce
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking

/**
 * Runs the whole first slice without Android: observe, resolve, tap, assert.
 * A host app replaces [FakeBackend] with the Android backend.
 */
fun main() = runBlocking {
    val backend = FakeBackend(Fixtures.rawSnapshot())
    val pce = Pce.create(backend)
    try {
        val snapshot = pce.observe().getOrThrow()
        println("snapshot=${snapshot.id} backend=${snapshot.backend} nodes=${snapshot.nodes.size}")

        val search = pce.resolve(
            snapshot.id,
            Selector(viewId = "com.example:id/search"),
        ).getOrThrow()
        println("resolved node=${search.node.id} text=${search.node.text} bounds=${search.node.bounds}")

        val ambiguous = pce.resolve(snapshot.id, Selector(text = "Add"))
        val ambiguousError = (ambiguous as PceResult.Err).error
        println("ambiguous=${ambiguousError.code} candidates=${ambiguousError.candidates}")

        val tap = pce.act(
            snapshot.id,
            Action.Tap(Target.Node(search.node.id)),
        ).getOrThrow()
        println("tap backend=${tap.backend} sent=${backend.executed.last()}")

        val assertResult = pce.act(
            snapshot.id,
            Action.Assert(Selector(viewId = "com.example:id/search")),
        ).getOrThrow()
        println("assert backend=${assertResult.backend}")
    } finally {
        pce.close()
    }
}
