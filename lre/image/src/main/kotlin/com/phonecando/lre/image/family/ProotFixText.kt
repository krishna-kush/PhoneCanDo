package com.phonecando.lre.image.family

/** The file contents behind each [ProotFix]. Pure. */
internal object ProotFixText {
    /** Dropped into `/etc/apt/apt.conf.d/`. */
    const val APT_CONF_NAME = "99phonecando-proot"

    const val APT_CONF = "// PhoneCanDo: proot cannot switch to the _apt sandbox user, so apt stays root.\n" +
        "APT::Sandbox::User \"root\";\n"

    private const val PACMAN_NOTE = "# PhoneCanDo: proot has no Landlock or seccomp sandbox for pacman."
    private val DISABLE_SANDBOX = Regex("^\\s*DisableSandbox\\s*$")
    private val DOWNLOAD_USER = Regex("^\\s*DownloadUser\\s*=")
    private val SECTION = Regex("^\\s*\\[(.+)]\\s*$")

    /**
     * pacman.conf with `DisableSandbox` set in `[options]` (pacman 7.0; from
     * 7.1 it means both DisableSandboxFilesystem and DisableSandboxSyscalls)
     * and `DownloadUser` commented out, since proot cannot drop to that user
     * either. Idempotent: a second pass returns its input.
     */
    fun pacmanConf(text: String): String {
        val lines = text.lines().map { if (DOWNLOAD_USER.containsMatchIn(it)) "#$it" else it }.toMutableList()
        var section: String? = null
        var optionsAt = -1
        var disabled = false
        lines.forEachIndexed { i, line ->
            SECTION.find(line)?.let {
                section = it.groupValues[1].trim()
                if (section == "options" && optionsAt < 0) optionsAt = i
            }
            if (section == "options" && DISABLE_SANDBOX.matches(line)) disabled = true
        }
        if (!disabled) {
            if (optionsAt >= 0) {
                lines.addAll(optionsAt + 1, listOf(PACMAN_NOTE, "DisableSandbox"))
            } else {
                if (lines.lastOrNull()?.isEmpty() == true) lines.removeAt(lines.size - 1)
                lines.addAll(listOf("[options]", PACMAN_NOTE, "DisableSandbox", ""))
            }
        }
        return lines.joinToString("\n")
    }
}
