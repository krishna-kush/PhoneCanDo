package com.phonecando.lre.image.conf

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.image.family.Families

/** Builds `run/os-note.md`, the line the agent's instructions get about this machine. Pure. */
internal object OsNote {
    fun text(os: OsInfo): String {
        val name = os.prettyName ?: listOfNotNull(os.id, os.versionId).joinToString(" ")
        val traits = os.family?.let(Families::of)
        val manager = traits?.let { " (${it.family.id})" }.orEmpty()
        val install = traits?.let { " Install packages with `${it.installHint}`." }.orEmpty()
        return "This machine: $name$manager.$install No systemd: start services by hand. " +
            "Commands run as root, so no sudo is needed.\n"
    }
}
