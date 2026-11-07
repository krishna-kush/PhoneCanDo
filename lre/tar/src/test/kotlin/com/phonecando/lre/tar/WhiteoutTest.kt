package com.phonecando.lre.tar

import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals

/** OCI whiteouts across two layers. */
class WhiteoutTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    private val lower = TarBuilder()
        .file("a/file1", "1")
        .file("a/file2", "2")
        .file("b/sub/x", "x")
        .file("c/keep", "k")
        .file("d/old1", "o")
        .file("d/olddir/y", "y")
        .file("e/old", "o")
        .file("f/sub/lower", "l")
        .build()

    @Test
    fun `whiteout file, whiteout dir and opaque dirs in either order`() {
        guest.extract(lower)
        val stats = guest.extract(
            TarBuilder()
                .file("a/.wh.file1")
                .file(".wh.b")
                // Opaque marker after this layer's own entries in the dir.
                .dir("d")
                .file("d/new", "n")
                .file("d/.wh..wh..opq")
                // Opaque marker before them.
                .file("e/.wh..wh..opq")
                .file("e/new", "n")
                // This layer's nested entries survive, lower ones beside them don't.
                .file("f/sub/upper", "u")
                .file("f/.wh..wh..opq")
                .file("c/.wh.missing")
                .build(),
        )
        assertEquals(
            setOf("a", "a/file2", "c", "c/keep", "d", "d/new", "e", "e/new", "f", "f/sub", "f/sub/upper"),
            guest.tree(),
        )
        assertEquals(6, stats.whiteouts)
        assertEquals(3, stats.files)
    }

    @Test
    fun `a whiteout keeps what this layer itself wrote at that path`() {
        guest.extract(lower)
        guest.extract(TarBuilder().file("c/keep", "mine").file("c/.wh.keep").build())
        assertEquals("mine", guest.text("c/keep"))
    }

    @Test
    fun `a whiteout removes a lower symlink, not its target`() {
        guest.extract(TarBuilder().file("real/file", "r").symlink("alias", "real").build())
        guest.extract(TarBuilder().file(".wh.alias").build())
        assertEquals(setOf("real", "real/file"), guest.tree())
    }

    @Test
    fun `an opaque root hides every lower path`() {
        guest.extract(lower)
        guest.extract(TarBuilder().file("only", "o").file(".wh..wh..opq").build())
        assertEquals(setOf("only"), guest.tree())
    }

    @Test
    fun `aufs bookkeeping names are skipped`() {
        guest.extract(lower)
        val stats = guest.extract(
            TarBuilder().dir(".wh..wh.plnk").file(".wh..wh.plnk/123.456").file("a/.wh..wh.aufs").build(),
        )
        assertEquals(3, stats.skipped)
        assertEquals(0, stats.whiteouts)
        assertEquals("1", guest.text("a/file1"))
        assertEquals(false, guest.exists(".wh..wh.plnk"))
    }
}
