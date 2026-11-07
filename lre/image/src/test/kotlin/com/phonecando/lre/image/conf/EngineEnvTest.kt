package com.phonecando.lre.image.conf

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.image.support.Hosts
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class EngineEnvTest {
    private val r = "/data/user/0/com.phonecando.app/files/images/d1"

    @Test
    fun `golden engine env for a linux image`() {
        assertEquals(
            "HOME=$r/home\n" +
                "TMPDIR=$r/tmp\n" +
                "SHELL=$r/shims/bash\n" +
                "PATH=$r/shims:/product/bin:/apex/com.android.runtime/bin:/system/bin\n" +
                "PHONECANDO_IMAGE=$r\n",
            EngineEnv.linux(Hosts.phoneLayout, Hosts.phone),
        )
    }

    @Test
    fun `an android image gets HOME and TMPDIR only`() {
        assertEquals("HOME=$r/home\nTMPDIR=$r/tmp\n", EngineEnv.android(Hosts.phoneLayout))
    }

    @Test
    fun `an empty host PATH leaves shims alone`() {
        val env = EngineEnv.linux(Hosts.phoneLayout, Hosts.phone.copy(hostPath = ""))
        assertEquals("PATH=$r/shims", env.lines().first { it.startsWith("PATH=") })
    }

    @Test
    fun `values are newline-checked`() {
        val bad = ImageLayout(File("/data/user/0/x/images/a\nb"))
        assertFailsWith<LreException.UnsafeEntry> { EngineEnv.android(bad) }
        assertFailsWith<LreException.UnsafeEntry> { EngineEnv.linux(Hosts.phoneLayout, Hosts.phone.copy(hostPath = "/a\n/b")) }
    }
}
