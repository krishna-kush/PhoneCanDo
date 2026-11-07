package com.phonecando.lre.image.detect

import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.image.guest.GuestPath

/**
 * What an image config's `Env` may give the guest. Pure.
 *
 * Refused: names that are not identifiers, values launch.conf cannot carry
 * (a line break or NUL), the `LD_*` and `PROOT_*` namespaces (read by the
 * host-side proot exec before anything is confined), our own `PHONECANDO_*`,
 * and the per-session variables we decide ourselves.
 */
internal object ImageEnv {
    private val NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")
    private val OURS = setOf(
        "PATH", "HOME", "TMPDIR", "SHELL", "USER", "LOGNAME", "TERM", "COLORTERM", "PWD", "OLDPWD", "SHLVL",
    )
    private val HOST_PREFIXES = listOf("LD_", "PROOT_", "PHONECANDO_")

    /** Every usable `KEY=VALUE` of [config], the last one winning for a repeated key. */
    fun pairs(config: ImageConfig?): List<Pair<String, String>> {
        val out = LinkedHashMap<String, String>()
        for (entry in config?.env.orEmpty()) {
            val eq = entry.indexOf('=')
            if (eq <= 0) continue
            val key = entry.substring(0, eq)
            val value = entry.substring(eq + 1)
            if (!NAME.matches(key) || value.any { it == '\n' || it == '\r' || it == '\u0000' }) continue
            out.remove(key)
            out[key] = value
        }
        return out.toList()
    }

    /** The guest PATH: the image config's when it names an absolute dir, else [GuestPath.DEFAULT]. */
    fun guestPath(config: ImageConfig?): String =
        pairs(config).lastOrNull { it.first == "PATH" }?.second?.takeIf { GuestPath.dirs(it).isNotEmpty() }
            ?: GuestPath.DEFAULT

    /** The image's variables launch.conf passes on as they are (PATH and ours excluded). */
    fun exported(config: ImageConfig?): List<Pair<String, String>> =
        pairs(config).filter { (key, _) -> key !in OURS && HOST_PREFIXES.none(key::startsWith) }
}
