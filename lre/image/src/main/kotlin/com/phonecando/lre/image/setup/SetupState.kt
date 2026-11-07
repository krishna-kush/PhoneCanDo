package com.phonecando.lre.image.setup

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.files.TextFiles
import java.io.File

/**
 * `run/setup-state`: the Linux steps done so far, one id per line, or the
 * single line `android` for an image with no Linux. Steps run in order, so
 * the done ones are always a prefix of [SetupStep.entries]; a retry resumes
 * at the first missing one.
 */
internal object SetupState {
    private const val ANDROID = "android"

    fun file(layout: ImageLayout): File = File(layout.run, "setup-state")

    fun done(layout: ImageLayout): List<SetupStep> {
        val ids = lines(layout)
        return SetupStep.entries.takeWhile { it.id in ids }
    }

    fun isAndroid(layout: ImageLayout): Boolean = ANDROID in lines(layout)

    fun isReady(layout: ImageLayout): Boolean = isAndroid(layout) || done(layout).size == SetupStep.entries.size

    /** Records [step] and every step before it, and forgets the ones after. */
    fun markDone(layout: ImageLayout, step: SetupStep) {
        TextFiles.write(file(layout), SetupStep.entries.take(step.ordinal + 1).joinToString("") { "${it.id}\n" })
    }

    fun markAndroid(layout: ImageLayout) {
        TextFiles.write(file(layout), "$ANDROID\n")
    }

    private fun lines(layout: ImageLayout): Set<String> =
        TextFiles.read(file(layout))?.lineSequence()?.map { it.trim() }?.filter { it.isNotEmpty() }?.toSet().orEmpty()
}
