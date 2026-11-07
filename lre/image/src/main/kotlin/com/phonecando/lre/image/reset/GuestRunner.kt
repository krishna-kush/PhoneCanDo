package com.phonecando.lre.image.reset

import com.phonecando.lre.api.ImageLayout

/** Runs one command inside a ready image; the Android host goes through our launcher. */
fun interface GuestRunner {
    /** Runs [argv] (argv[0] a guest command name) in the image at [layout]. */
    fun run(layout: ImageLayout, argv: List<String>): GuestResult
}

/** How a guest command ended and what it printed on stdout. */
data class GuestResult(val exitCode: Int, val stdout: String)
