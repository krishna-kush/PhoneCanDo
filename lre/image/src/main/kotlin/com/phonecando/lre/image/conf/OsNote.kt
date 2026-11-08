package com.phonecando.lre.image.conf

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.family.Families

/** Builds `run/os-note.md`, the lines the agent's instructions get about this machine. Pure. */
internal object OsNote {
    // Android 12+ kills an app's child processes past a device-wide cap (the
    // phantom process killer): a parallel build is the usual victim, and it
    // shows only as a SIGKILL. The agent can explain it and work around it.
    const val PHANTOM = "If a command dies with signal 9 (exit 137) while many processes run, " +
        "Android stopped it (its phantom process limit): retry with fewer parallel jobs, and " +
        "tell the user they can turn on \"Disable child process restrictions\" in Developer options."

    // Many sandboxes kill or wait for what a command leaves running; ours
    // does neither (lre/launcher standin.c), so servers can just be started.
    const val BACKGROUND = "Background processes work as on a PC: a command returns when it ends, and " +
        "what it starts with `&`, nohup or as a daemon keeps running (see it with ps, stop it with kill) " +
        "until it exits or the app stops this agent."

    fun text(os: OsInfo): String {
        val name = os.prettyName ?: listOfNotNull(os.id, os.versionId).joinToString(" ")
        val traits = os.family?.let(Families::of)
        val manager = traits?.let { " (${it.family.id})" }.orEmpty()
        val install = traits?.let { " Install packages with `${it.installHint}`." }.orEmpty()
        return "This machine: $name$manager.$install No systemd: start services by hand. $BACKGROUND " +
            "Commands run as root, so no sudo is needed. $PHANTOM\n"
    }
}
