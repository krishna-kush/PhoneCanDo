package com.phonecando.lre.cli.progress

import com.phonecando.network.Progress
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class ProgressLinesTest {
    private val mib = 1_048_576L

    @Test
    fun `setup steps by number, byte counts in MiB`() {
        assertEquals("[lre-cli] setup 2/6: unpack", ProgressLines.format(Progress("unpack", 1, 6)))
        assertEquals("[lre-cli] setup 6/6: seed", ProgressLines.format(Progress("seed", 5, 6)))
        assertEquals("[lre-cli] download 1.5 MiB / 30.0 MiB", ProgressLines.format(Progress("download", 3 * mib / 2, 30 * mib)))
        assertEquals("[lre-cli] unpack 1.0 MiB", ProgressLines.format(Progress("unpack", mib, null)))
        // Not ImageSetup's shape (wrong ordinal for the step): a byte count.
        assertEquals("[lre-cli] unpack 0.0 MiB / 0.0 MiB", ProgressLines.format(Progress("unpack", 4, 6)))
    }

    @Test
    fun `a download is throttled and ends on its final count`() {
        val lines = ProgressLines(intervalMillis = 1000)
        val total = 10 * mib
        assertEquals(listOf("[lre-cli] download 0.0 MiB / 10.0 MiB"), lines.next(Progress("download", 0, total), 0))
        assertEquals(emptyList(), lines.next(Progress("download", mib, total), 500))
        assertEquals(listOf("[lre-cli] download 2.0 MiB / 10.0 MiB"), lines.next(Progress("download", 2 * mib, total), 1000))
        assertEquals(listOf("[lre-cli] download 10.0 MiB / 10.0 MiB"), lines.next(Progress("download", total, total), 1100))
        assertEquals(listOf("[lre-cli] setup 1/6: space"), lines.next(Progress("space", 0, 6), 1200))
    }

    @Test
    fun `an unpack count held back prints before the next setup step`() {
        val lines = ProgressLines(intervalMillis = 1000)
        assertEquals(listOf("[lre-cli] setup 2/6: unpack"), lines.next(Progress("unpack", 1, 6), 0))
        assertEquals(listOf("[lre-cli] unpack 0.0 MiB"), lines.next(Progress("unpack", 0, null), 10))
        assertEquals(emptyList(), lines.next(Progress("unpack", mib, null), 20))
        assertEquals(emptyList(), lines.next(Progress("unpack", 4 * mib, null), 30))
        assertEquals(
            listOf("[lre-cli] unpack 4.0 MiB", "[lre-cli] setup 3/6: detect"),
            lines.next(Progress("detect", 2, 6), 40),
        )
        assertEquals(emptyList(), lines.flush())
    }

    @Test
    fun `flush at the end prints what is held`() {
        val lines = ProgressLines(intervalMillis = 1000)
        lines.next(Progress("download", 0, null), 0)
        lines.next(Progress("download", 5, null), 1)
        assertEquals(listOf("[lre-cli] download 0.0 MiB"), lines.flush())
    }
}
