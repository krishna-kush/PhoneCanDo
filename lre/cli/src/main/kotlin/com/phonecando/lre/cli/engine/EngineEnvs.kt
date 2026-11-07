package com.phonecando.lre.cli.engine

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import java.io.File

/** The engine environment of one set-up image, read from disk. */
object EngineEnvs {
    /**
     * @throws LreException.NotFound when the image has no run/engine.env (setup never ran).
     * @throws LreException.Corrupt when it names no SHELL (an image with no Linux).
     */
    fun linux(imageDir: File): Map<String, String> {
        val file = ImageLayout(imageDir).engineEnv
        if (!file.isFile) throw LreException.NotFound("run/engine.env under $imageDir")
        val env = EngineEnvFile.parse(file.readText())
        if (env["SHELL"].isNullOrEmpty()) throw LreException.Corrupt("run/engine.env (no SHELL: not a Linux image)")
        return env
    }
}
