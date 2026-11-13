package com.phonecando.lre.image.fixup

import com.phonecando.lre.api.OsInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class HostnameTest {
    private fun os(id: String) = OsInfo(id, null, emptyList(), null, null, "/bin/sh")

    @Test
    fun `the os-release ID becomes one hostname label`() {
        assertEquals("debian", Hostname.forOs(os("debian")))
        assertEquals("opensuse-tumbleweed", Hostname.forOs(os("opensuse-tumbleweed")))
        assertEquals("rhel-like", Hostname.forOs(os("RHEL_like.")))
        assertEquals("linux", Hostname.forOs(os("__")))
        assertEquals(63, Hostname.forOs(os("a".repeat(80))).length)
    }

    @Test
    fun `parse takes the first line when it is a valid hostname`() {
        assertEquals("box", Hostname.parse("box\n"))
        assertEquals("My-Box.local", Hostname.parse("  My-Box.local  \nignored\n"))
        listOf(null, "", "\n", "-box", "box-", "my box", "a..b", "b\\ox", "x".repeat(65), "x".repeat(64))
            .forEach { assertNull(Hostname.parse(it), "$it") }
    }

    @Test
    fun `a name other than the one we wrote is kept, anything else gets the OS's`() {
        assertEquals("box", Hostname.choose("box\n", "debian", "debian"))
        assertEquals("debian", Hostname.choose("debian\n", "debian", "debian"))
        assertEquals("ubuntu", Hostname.choose("debian\n", "debian", "ubuntu"))
        assertEquals("debian", Hostname.choose("phonecando\n", null, "debian"))
        assertEquals("debian", Hostname.choose(null, "debian", "debian"))
        assertEquals("debian", Hostname.choose("not valid!\n", "debian", "debian"))
    }
}
