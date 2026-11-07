package com.phonecando.lre.cli.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class EngineEnvFileTest {
    @Test
    fun `parses KEY=VALUE lines verbatim, split at the first =`() {
        val text = "HOME=/w/i/home\nTMPDIR=/w/i/tmp\nSHELL=/w/i/shims/bash\nPATH=/w/i/shims:/usr/bin\n" +
            "\nJUNK\nX=a=b c\n=nokey\nHOME=/later\n"
        assertEquals(
            mapOf(
                "HOME" to "/later",
                "TMPDIR" to "/w/i/tmp",
                "SHELL" to "/w/i/shims/bash",
                "PATH" to "/w/i/shims:/usr/bin",
                "X" to "a=b c",
            ),
            EngineEnvFile.parse(text),
        )
    }

    @Test
    fun `exports quote every value for eval`() {
        assertEquals(
            "export A='/w/x y'\nexport B='it'\\''s \$HOME'\nexport C=''\n",
            EngineEnvFile.exports(linkedMapOf("A" to "/w/x y", "B" to "it's \$HOME", "C" to "")),
        )
    }
}
