package com.phonecando.lre.cli.progress

import com.phonecando.lre.api.Progress
import com.phonecando.lre.image.setup.SetupStep
import java.util.Locale

/**
 * Which progress reports become stderr lines, and their text. Pure: the
 * clock comes in.
 *
 * Two kinds of report share step names: ImageSetup's own, one per setup step
 * (`unpack` as step 2 of 6), and the byte counts of lre/oci's `download` and
 * lre/tar's `unpack`. A setup step always prints. Byte counts print at most
 * once per [intervalMillis] (and when complete); a count held back is printed
 * before the next step's line, so every byte step ends on its final count.
 */
class ProgressLines(private val intervalMillis: Long = 2_000) {
    private var lastStep: String? = null
    private var lastAt = 0L
    private var held: String? = null

    /** The lines to print for [progress] at [nowMillis], oldest first; often none. */
    fun next(progress: Progress, nowMillis: Long): List<String> {
        if (isSetupStep(progress)) return flush() + format(progress).also { restart(null, nowMillis) }
        val line = format(progress)
        if (progress.step != lastStep) return flush() + line.also { restart(progress.step, nowMillis) }
        val complete = progress.total?.let { progress.done >= it } ?: false
        if (!complete && nowMillis - lastAt < intervalMillis) {
            held = line
            return emptyList()
        }
        return listOf(line).also { restart(progress.step, nowMillis) }
    }

    /** A held-back count, at the end of the job. */
    fun flush(): List<String> = listOfNotNull(held).also { held = null }

    private fun restart(step: String?, nowMillis: Long) {
        lastStep = step
        lastAt = nowMillis
        held = null
    }

    companion object {
        /** ImageSetup's report for one of its steps: `Progress(step.id, step.ordinal, SetupStep.entries.size)`. */
        fun isSetupStep(progress: Progress): Boolean =
            progress.total == SetupStep.entries.size.toLong() &&
                SetupStep.entries.any { it.id == progress.step && it.ordinal.toLong() == progress.done }

        fun format(progress: Progress): String {
            if (isSetupStep(progress)) return "[lre-cli] setup ${progress.done + 1}/${progress.total}: ${progress.step}"
            val total = progress.total
            return "[lre-cli] ${progress.step} ${mib(progress.done)}" + (total?.let { " / " + mib(it) } ?: "")
        }

        private fun mib(bytes: Long) = String.format(Locale.ROOT, "%.1f MiB", bytes / 1_048_576.0)
    }
}
