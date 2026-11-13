package com.phonecando.lre.image.proc

import kotlin.test.Test
import kotlin.test.assertEquals

class UnameTest {
    @Test
    fun `the full kernel-release form names the host, our kernel and the machine`() {
        val fields = Uname("debian", "aarch64").prootArg().removePrefix("--kernel-release=").split('\\')
        assertEquals(
            listOf("", "Linux", "debian", FakeProc.KERNEL_RELEASE, FakeProc.KERNEL_VERSION, "aarch64", "(none)", "-1", ""),
            fields,
        )
    }

    @Test
    fun `a JVM's os arch becomes uname's machine`() {
        assertEquals("x86_64", Uname.machine("amd64"))
        assertEquals("aarch64", Uname.machine("aarch64"))
    }
}
