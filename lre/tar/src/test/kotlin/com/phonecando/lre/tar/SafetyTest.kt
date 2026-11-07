package com.phonecando.lre.tar

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Every hostile shape we know of: rejected or kept inside the root, never a byte outside it. */
class SafetyTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    /** The canary sibling of dest, as an archive reaches it from the root. */
    private val up = "../canary"

    @AfterEach
    fun nothingOutside() = guest.assertOutsideUntouched()

    private fun rejects(archive: TarBuilder) {
        assertFailsWith<LreException.UnsafeEntry> { guest.extract(archive.build()) }
    }

    @Test
    fun `dot-dot escapes are rejected`() {
        rejects(TarBuilder().file("$up/pwned", "x"))
        rejects(TarBuilder().file("a/../../canary/pwned", "x"))
        rejects(TarBuilder().dir("../escape"))
        rejects(TarBuilder().symlink("..", "anything"))
    }

    @Test
    fun `absolute names are rejected`() {
        rejects(TarBuilder().file("${guest.canary}/pwned", "x"))
        rejects(TarBuilder().file("/etc/passwd", "x"))
    }

    @Test
    fun `a relative symlinked parent cannot lead out`() {
        rejects(TarBuilder().symlink("link", up).file("link/pwned", "x"))
        rejects(TarBuilder().dir("a").symlink("a/link", "../../canary").file("a/link/pwned", "x"))
    }

    @Test
    fun `chained symlinks cannot lead out`() {
        rejects(TarBuilder().symlink("one", "two").symlink("two", "d/../$up").file("one/pwned", "x"))
    }

    @Test
    fun `an absolute symlinked parent resolves inside the guest`() {
        val canary = guest.canary.toString()
        guest.extract(TarBuilder().symlink("link", canary).file("link/landed", "x").build())
        assertEquals("x", guest.text(canary.removePrefix("/") + "/landed"))
    }

    @Test
    fun `an absolute symlink climbing above the guest root is rejected`() {
        rejects(TarBuilder().symlink("link", "/../../..${guest.canary}").file("link/pwned", "x"))
    }

    @Test
    fun `symlink loops are rejected`() {
        rejects(TarBuilder().symlink("a", "b").symlink("b", "a").file("a/x", "x"))
        rejects(TarBuilder().symlink("self", "self/more").file("self/x", "x"))
    }

    @Test
    fun `hard link targets cannot reach outside`() {
        rejects(TarBuilder().hardlink("stolen", "$up/secret"))
        rejects(TarBuilder().hardlink("stolen", "${guest.secret}"))
        rejects(TarBuilder().symlink("link", up).hardlink("stolen", "link/secret"))
        assertFalse(guest.exists("stolen"))
    }

    @Test
    fun `a hard link through an absolute symlink stays inside and finds nothing`() {
        assertFailsWith<LreException.Corrupt> {
            guest.extract(TarBuilder().symlink("link", guest.canary.toString()).hardlink("stolen", "link/secret").build())
        }
        assertFalse(guest.exists("stolen"))
    }

    @Test
    fun `a file never writes through a symlink at its own path`() {
        guest.extract(TarBuilder().symlink("passwd", "$up/secret").build())
        guest.extract(TarBuilder().file("passwd", "replaced").build())
        assertFalse(guest.isSymlink("passwd"))
        assertEquals("replaced", guest.text("passwd"))
    }

    @Test
    fun `a dir entry replaces a symlink at its path instead of following it`() {
        guest.extract(TarBuilder().symlink("d", up).dir("d").file("d/inside", "x").build())
        assertTrue(guest.isDir("d"))
        assertEquals("x", guest.text("d/inside"))
    }

    @Test
    fun `replacing or whiting out a tree removes links in it, never their targets`() {
        val outward = TarBuilder()
            .symlink("d/rel", "../../canary")
            .symlink("d/abs", guest.canary.toString())
            .symlink("d/file", "../../canary/secret")
        guest.extract(outward.build())
        guest.extract(TarBuilder().file("d", "file now").build())
        guest.extract(outward.build())
        guest.extract(TarBuilder().file(".wh.d").build())
        guest.extract(outward.build())
        guest.extract(TarBuilder().file("d/.wh..wh..opq").build())
        assertEquals(setOf("d"), guest.tree())
    }

    @Test
    fun `whiteouts cannot delete outside`() {
        rejects(TarBuilder().symlink("link", up).file("link/.wh.secret"))
        rejects(TarBuilder().symlink("link", up).file("link/.wh..wh..opq"))
        rejects(TarBuilder().file(".wh.."))
    }

    @Test
    fun `a whiteout through an absolute symlink stays inside`() {
        guest.extract(TarBuilder().symlink("link", guest.canary.toString()).file("link/.wh.secret").build())
    }

    @Test
    fun `NUL bytes in names are rejected`() {
        rejects(TarBuilder().pax(mapOf("path" to "a\u0000b")).file("x", "x"))
    }
}
