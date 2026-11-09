package com.phonecando.agents.kit.render

/**
 * A kind's install (or update) for one image: [script] is POSIX sh for the
 * guest's `sh -s`, which prints `@phase <name>` as it starts each of
 * [phases] (`runtime:<id>` per runtime, then `packages`, `install` or
 * `update`, and `verify`), and may run [timeoutSec] in all. When a unit of
 * a phase fails and will run again, it prints `@retry <phase> <n>/<max>` on
 * its own line before it waits: n is the attempt about to start (2 for the
 * first retry), of `max` in all.
 */
data class InstallPlan(val script: String, val timeoutSec: Int, val phases: List<String>)

/** [kind] has no install recipe for the image's [family]; [supported] is what it installs on (null: any). */
class NoRecipe(val kind: String, val family: String, val supported: List<String>?) :
  IllegalArgumentException(
    "$kind cannot be installed on $family" + (supported?.let { ": it installs on ${it.joinToString().ifEmpty { "none" }}" } ?: ""),
  )
