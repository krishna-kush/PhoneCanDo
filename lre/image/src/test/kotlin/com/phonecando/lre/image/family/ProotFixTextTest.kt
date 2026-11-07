package com.phonecando.lre.image.family

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProotFixTextTest {
    private val stock = "[options]\nHoldPkg = pacman glibc\nDownloadUser = alpm\n#DisableSandbox\n\n[core]\nInclude = x\n"

    @Test
    fun `pacman gets DisableSandbox in options and no DownloadUser`() {
        val fixed = ProotFixText.pacmanConf(stock)
        val lines = fixed.lines()
        val options = lines.indexOf("[options]")
        assertEquals("DisableSandbox", lines[options + 2])
        assertTrue("#DownloadUser = alpm" in lines)
        assertTrue(lines.indexOf("DisableSandbox") < lines.indexOf("[core]"))
        assertTrue(fixed.endsWith("Include = x\n"))
    }

    @Test
    fun `pacman fix is idempotent`() {
        val once = ProotFixText.pacmanConf(stock)
        assertEquals(once, ProotFixText.pacmanConf(once))
    }

    @Test
    fun `a config without options gets one`() {
        val fixed = ProotFixText.pacmanConf("[core]\nInclude = x\n")
        assertTrue(fixed.endsWith("[options]\n# PhoneCanDo: proot has no Landlock or seccomp sandbox for pacman.\nDisableSandbox\n"))
        assertEquals(fixed, ProotFixText.pacmanConf(fixed))
    }

    @Test
    fun `an already-disabled sandbox is left alone`() {
        val text = "[options]\nDisableSandbox\n"
        assertEquals(text, ProotFixText.pacmanConf(text))
    }

    @Test
    fun `apt keeps root as its sandbox user`() {
        assertTrue("APT::Sandbox::User \"root\";" in ProotFixText.APT_CONF)
    }
}
