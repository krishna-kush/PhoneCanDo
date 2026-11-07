package com.phonecando.lre.image.conf

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout

/**
 * Unix socket paths are capped at 108 bytes (sun_path), and tools put
 * sockets under home/ and tmp/ with names of their own (ssh agents, tmux,
 * language servers). We flag an image whose home or tmp, under any data-dir
 * spelling, leaves fewer than [NAME_ALLOWANCE] bytes for those names. Pure.
 */
object SocketBudget {
    const val SUN_PATH_BYTES = 108
    const val NAME_ALLOWANCE = 40

    /** True when a socket under home/ or tmp/ may not fit; the UI should suggest a shorter image id. */
    fun isTight(layout: ImageLayout, host: HostEnv): Boolean =
        (PathSpellings.of(layout.home.path, host.dataDirSpellings) + PathSpellings.of(layout.tmp.path, host.dataDirSpellings))
            .any { it.toByteArray(Charsets.UTF_8).size + NAME_ALLOWANCE > SUN_PATH_BYTES }
}
