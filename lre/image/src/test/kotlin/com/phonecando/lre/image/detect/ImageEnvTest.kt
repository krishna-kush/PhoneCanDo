package com.phonecando.lre.image.detect

import com.phonecando.lre.image.guest.GuestPath
import com.phonecando.lre.image.support.config
import kotlin.test.Test
import kotlin.test.assertEquals

class ImageEnvTest {
    @Test
    fun `the image PATH wins, else Debian's default`() {
        assertEquals("/opt/py/bin:/usr/bin", ImageEnv.guestPath(config("PATH=/opt/py/bin:/usr/bin")))
        assertEquals(GuestPath.DEFAULT, ImageEnv.guestPath(null))
        assertEquals(GuestPath.DEFAULT, ImageEnv.guestPath(config("PATH=relative:dirs")))
    }

    @Test
    fun `host-side and per-session variables never pass on`() {
        val exported = ImageEnv.exported(
            config(
                "PATH=/usr/bin", "LD_PRELOAD=/evil.so", "PROOT_LOADER=/evil", "PHONECANDO_IMAGE=/x",
                "HOME=/home/node", "TERM=dumb", "USER=node", "bad name=1", "MULTI=a\nb",
                "PYTHON_VERSION=3.13.1", "LANG=en_US.UTF-8", "PYTHON_VERSION=3.13.2", "EMPTY=",
            ),
        )
        assertEquals(listOf("LANG" to "en_US.UTF-8", "PYTHON_VERSION" to "3.13.2", "EMPTY" to ""), exported)
    }
}
